package main

import (
	"bufio"
	"database/sql"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	_ "github.com/lib/pq"
	_ "modernc.org/sqlite"
)

type config struct {
	PgURL         string
	SQLitePath    string
	SchemaPath    string
	MigrationsDir string
	Source        string
}

func main() {
	cfg := parseFlags()

	if cfg.SQLitePath == "" {
		fatal("sqlite output path is required")
	}

	if err := os.MkdirAll(filepath.Dir(cfg.SQLitePath), 0o755); err != nil {
		fatal("cannot create sqlite output directory: %v", err)
	}

	_ = os.Remove(cfg.SQLitePath)

	sqliteDB, err := sql.Open("sqlite", cfg.SQLitePath)
	if err != nil {
		fatal("cannot open sqlite: %v", err)
	}
	defer sqliteDB.Close()

	if err := applySchema(sqliteDB, cfg.SchemaPath); err != nil {
		fatal("cannot apply schema: %v", err)
	}

	if err := seedBibles(sqliteDB); err != nil {
		fatal("cannot seed bibles: %v", err)
	}

	source := strings.ToLower(cfg.Source)
	if source == "" {
		source = "postgres"
	}
	if source == "postgres" && cfg.PgURL == "" {
		source = "migrations"
	}

	switch source {
	case "postgres":
		if err := loadFromPostgres(sqliteDB, cfg.PgURL); err != nil {
			fatal("migration from postgres failed: %v", err)
		}
		if err := validateCountsFromPostgres(sqliteDB, cfg.PgURL); err != nil {
			fatal("validation failed: %v", err)
		}
	case "migrations":
		if err := loadFromMigrations(sqliteDB, cfg.MigrationsDir); err != nil {
			fatal("migration from migrations failed: %v", err)
		}
	default:
		fatal("unknown source: %s", source)
	}

	if _, err := sqliteDB.Exec("ANALYZE;"); err != nil {
		fatal("analyze failed: %v", err)
	}

	fmt.Printf("bible.sqlite generated at %s\n", cfg.SQLitePath)
}

func parseFlags() config {
	var cfg config
	flag.StringVar(&cfg.PgURL, "pg", os.Getenv("DATABASE_URL"), "Postgres connection string")
	flag.StringVar(&cfg.SQLitePath, "sqlite", "dist/db/bible.sqlite", "SQLite output path")
	flag.StringVar(&cfg.SchemaPath, "schema", "tools/schema.sql", "SQLite schema path")
	flag.StringVar(&cfg.MigrationsDir, "migrations", "migrations", "Migrations directory with INSERT statements")
	flag.StringVar(&cfg.Source, "source", "postgres", "Source: postgres or migrations")
	flag.Parse()

	return cfg
}

func applySchema(db *sql.DB, schemaPath string) error {
	content, err := os.ReadFile(schemaPath)
	if err != nil {
		return err
	}

	statements := strings.Split(string(content), ";")
	for _, stmt := range statements {
		trimmed := strings.TrimSpace(stmt)
		if trimmed == "" {
			continue
		}
		if _, err := db.Exec(trimmed); err != nil {
			return fmt.Errorf("schema statement failed: %w", err)
		}
	}

	return nil
}

func seedBibles(db *sql.DB) error {
	_, err := db.Exec("INSERT OR IGNORE INTO bibles (id, version_name) VALUES (1, 'Reina Valera 1960')")
	return err
}

func loadFromMigrations(db *sql.DB, migrationsDir string) error {
	files := []string{
		"20240412184408_INSERT_INTO_TABLE_BOOK.up.sql",
		"20240412184419_INSERT_INTO_TABLE_CHAPTERS.up.sql",
		"20240412184427_INSERT_INTO_TABLE_VERSES.up.sql",
		"20240412184450_INSERT_INTO_TABLE_CHAPTERS_VERSES.up.sql",
	}

	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	for _, file := range files {
		path := filepath.Join(migrationsDir, file)
		if err := execInsertFile(tx, path); err != nil {
			return fmt.Errorf("%s: %w", file, err)
		}
	}

	if _, err := tx.Exec("UPDATE books SET bible_id = 1 WHERE bible_id IS NULL"); err != nil {
		return err
	}

	return tx.Commit()
}

func execInsertFile(tx *sql.Tx, path string) error {
	file, err := os.Open(path)
	if err != nil {
		return err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	buf := make([]byte, 0, 1024*1024)
	scanner.Buffer(buf, 8*1024*1024)

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "--") {
			continue
		}
		if !strings.HasPrefix(strings.ToUpper(line), "INSERT INTO") {
			continue
		}
		line = strings.Replace(line, "INSERT INTO public.", "INSERT INTO ", 1)
		line = strings.Replace(line, "(id, book, index, research, title)", "(id, book, \"index\", research, title)", 1)
		line = strings.Replace(line, "(id, chapter, research, index, content)", "(id, chapter, research, \"index\", content)", 1)
		if _, err := tx.Exec(line); err != nil {
			return fmt.Errorf("insert failed: %w", err)
		}
	}

	return scanner.Err()
}

func loadFromPostgres(sqliteDB *sql.DB, pgURL string) error {
	pgDB, err := sql.Open("postgres", pgURL)
	if err != nil {
		return err
	}
	defer pgDB.Close()

	tx, err := sqliteDB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if err := copyBibles(pgDB, tx); err != nil {
		return err
	}
	if err := copyBooks(pgDB, tx); err != nil {
		return err
	}
	if err := copyChapters(pgDB, tx); err != nil {
		return err
	}
	if err := copyVerses(pgDB, tx); err != nil {
		return err
	}
	if err := copyChaptersVerses(pgDB, tx); err != nil {
		return err
	}

	return tx.Commit()
}

func copyBibles(pgDB *sql.DB, tx *sql.Tx) error {
	rows, err := pgDB.Query("SELECT id, version_name FROM bibles ORDER BY id")
	if err != nil {
		return err
	}
	defer rows.Close()

	stmt, err := tx.Prepare("INSERT INTO bibles (id, version_name) VALUES (?, ?)")
	if err != nil {
		return err
	}
	defer stmt.Close()

	for rows.Next() {
		var id int
		var name string
		if err := rows.Scan(&id, &name); err != nil {
			return err
		}
		if _, err := stmt.Exec(id, name); err != nil {
			return err
		}
	}

	return rows.Err()
}

func copyBooks(pgDB *sql.DB, tx *sql.Tx) error {
	rows, err := pgDB.Query("SELECT name, title, bible_id FROM books ORDER BY name")
	if err != nil {
		return err
	}
	defer rows.Close()

	stmt, err := tx.Prepare("INSERT INTO books (name, title, bible_id) VALUES (?, ?, ?)")
	if err != nil {
		return err
	}
	defer stmt.Close()

	for rows.Next() {
		var name, title string
		var bibleID sql.NullInt64
		if err := rows.Scan(&name, &title, &bibleID); err != nil {
			return err
		}
		id := int64(1)
		if bibleID.Valid {
			id = bibleID.Int64
		}
		if _, err := stmt.Exec(name, title, id); err != nil {
			return err
		}
	}

	return rows.Err()
}

func copyChapters(pgDB *sql.DB, tx *sql.Tx) error {
	rows, err := pgDB.Query("SELECT id, book, index, research, title FROM chapters ORDER BY id")
	if err != nil {
		return err
	}
	defer rows.Close()

	stmt, err := tx.Prepare("INSERT INTO chapters (id, book, \"index\", research, title) VALUES (?, ?, ?, ?, ?)")
	if err != nil {
		return err
	}
	defer stmt.Close()

	for rows.Next() {
		var id int
		var book string
		var index int
		var research sql.NullString
		var title sql.NullString
		if err := rows.Scan(&id, &book, &index, &research, &title); err != nil {
			return err
		}
		if _, err := stmt.Exec(id, book, index, nullableString(research), nullableString(title)); err != nil {
			return err
		}
	}

	return rows.Err()
}

func copyVerses(pgDB *sql.DB, tx *sql.Tx) error {
	rows, err := pgDB.Query("SELECT id, chapter, research, index, content FROM verses ORDER BY id")
	if err != nil {
		return err
	}
	defer rows.Close()

	stmt, err := tx.Prepare("INSERT INTO verses (id, chapter, research, \"index\", content) VALUES (?, ?, ?, ?, ?)")
	if err != nil {
		return err
	}
	defer stmt.Close()

	for rows.Next() {
		var id int
		var chapter int
		var research sql.NullString
		var index int
		var content string
		if err := rows.Scan(&id, &chapter, &research, &index, &content); err != nil {
			return err
		}
		if _, err := stmt.Exec(id, chapter, nullableString(research), index, content); err != nil {
			return err
		}
	}

	return rows.Err()
}

func copyChaptersVerses(pgDB *sql.DB, tx *sql.Tx) error {
	rows, err := pgDB.Query("SELECT id, book, chapter, number_verses FROM chapters_verses ORDER BY id")
	if err != nil {
		return err
	}
	defer rows.Close()

	stmt, err := tx.Prepare("INSERT INTO chapters_verses (id, book, chapter, number_verses) VALUES (?, ?, ?, ?)")
	if err != nil {
		return err
	}
	defer stmt.Close()

	for rows.Next() {
		var id int
		var book string
		var chapter sql.NullInt64
		var number sql.NullInt64
		if err := rows.Scan(&id, &book, &chapter, &number); err != nil {
			return err
		}
		if _, err := stmt.Exec(id, book, nullableInt(chapter), nullableInt(number)); err != nil {
			return err
		}
	}

	return rows.Err()
}

func validateCountsFromPostgres(sqliteDB *sql.DB, pgURL string) error {
	pgDB, err := sql.Open("postgres", pgURL)
	if err != nil {
		return err
	}
	defer pgDB.Close()

	tables := []string{"bibles", "books", "chapters", "verses", "chapters_verses"}
	for _, table := range tables {
		pgCount, err := countRows(pgDB, table)
		if err != nil {
			return err
		}
		sqliteCount, err := countRows(sqliteDB, table)
		if err != nil {
			return err
		}
		if pgCount != sqliteCount {
			return fmt.Errorf("count mismatch for %s: postgres=%d sqlite=%d", table, pgCount, sqliteCount)
		}
	}

	return nil
}

func countRows(db *sql.DB, table string) (int, error) {
	row := db.QueryRow("SELECT COUNT(*) FROM " + table)
	var count int
	if err := row.Scan(&count); err != nil {
		return 0, err
	}
	return count, nil
}

func nullableString(value sql.NullString) interface{} {
	if value.Valid {
		return value.String
	}
	return nil
}

func nullableInt(value sql.NullInt64) interface{} {
	if value.Valid {
		return value.Int64
	}
	return nil
}

func fatal(format string, args ...interface{}) {
	fmt.Printf(format+"\n", args...)
	os.Exit(1)
}
