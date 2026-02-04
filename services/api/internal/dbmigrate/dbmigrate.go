package dbmigrate

import (
	"bufio"
	"context"
	"database/sql"
	"fmt"
	"io/fs"
	"sort"
	"strings"
	"time"

	"github.com/labstack/gommon/log"
)

type Migration struct {
	Version string
	File    string
}

type migrationKind int

const (
	migrationUnknown migrationKind = iota
	migrationCreateTable
	migrationInsert
)

func Run(ctx context.Context, db *sql.DB, source fs.FS) error {
	migrations, err := loadMigrations(source)
	if err != nil {
		return err
	}
	if len(migrations) == 0 {
		return nil
	}

	hadSchemaTable, err := tableExists(db, "schema_migrations")
	if err != nil {
		return err
	}
	if !hadSchemaTable {
		if err := ensureSchemaMigrations(db); err != nil {
			return err
		}
	}

	hasTables, err := hasUserTables(db)
	if err != nil {
		return err
	}

	if !hadSchemaTable && hasTables {
		log.Infof("schema_migrations missing; attempting baseline on existing database")
		return baselineMigrations(ctx, db, source, migrations)
	}

	applied, err := loadAppliedMigrations(db)
	if err != nil {
		return err
	}

	for _, migration := range migrations {
		if applied[migration.Version] {
			continue
		}
		if err := applyMigration(ctx, db, source, migration); err != nil {
			return err
		}
	}

	return nil
}

func loadMigrations(source fs.FS) ([]Migration, error) {
	entries, err := fs.ReadDir(source, ".")
	if err != nil {
		return nil, err
	}
	migrations := make([]Migration, 0)
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if !strings.HasSuffix(name, ".up.sql") {
			continue
		}
		version := strings.TrimSuffix(name, ".up.sql")
		migrations = append(migrations, Migration{Version: version, File: name})
	}
	sort.Slice(migrations, func(i, j int) bool {
		return migrations[i].Version < migrations[j].Version
	})
	return migrations, nil
}

func baselineMigrations(ctx context.Context, db *sql.DB, source fs.FS, migrations []Migration) error {
	for _, migration := range migrations {
		kind, table, err := classifyMigration(source, migration.File)
		if err != nil {
			return err
		}
		alreadyApplied := false
		switch kind {
		case migrationCreateTable:
			if table != "" {
				exists, err := tableExists(db, table)
				if err != nil {
					return err
				}
				alreadyApplied = exists
			}
		case migrationInsert:
			if table != "" {
				exists, err := tableExists(db, table)
				if err != nil {
					return err
				}
				if exists {
					count, err := countTableRows(ctx, db, table)
					if err != nil {
						return err
					}
					alreadyApplied = count > 0
				}
			}
		}

		if alreadyApplied {
			log.Infof("baseline: marking %s as applied", migration.Version)
			if err := markApplied(db, migration.Version); err != nil {
				return err
			}
			continue
		}

		if err := applyMigration(ctx, db, source, migration); err != nil {
			return err
		}
	}
	return nil
}

func applyMigration(ctx context.Context, db *sql.DB, source fs.FS, migration Migration) error {
	log.Infof("applying migration %s", migration.Version)

	kind, _, err := classifyMigration(source, migration.File)
	if err != nil {
		return err
	}

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if kind == migrationInsert {
		if err := execInsertFile(tx, source, migration.File); err != nil {
			return fmt.Errorf("%s: %w", migration.File, err)
		}
	} else {
		content, err := fs.ReadFile(source, migration.File)
		if err != nil {
			return err
		}
		if err := execStatements(ctx, tx, string(content)); err != nil {
			return fmt.Errorf("%s: %w", migration.File, err)
		}
	}

	if err := markAppliedTx(tx, migration.Version); err != nil {
		return err
	}
	return tx.Commit()
}

func ensureSchemaMigrations(db *sql.DB) error {
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version TEXT PRIMARY KEY,
			applied_at TEXT NOT NULL
		);
	`)
	return err
}

func loadAppliedMigrations(db *sql.DB) (map[string]bool, error) {
	rows, err := db.Query(`SELECT version FROM schema_migrations`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	applied := make(map[string]bool)
	for rows.Next() {
		var version string
		if err := rows.Scan(&version); err != nil {
			return nil, err
		}
		applied[version] = true
	}
	return applied, rows.Err()
}

func markApplied(db *sql.DB, version string) error {
	_, err := db.Exec(`INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)`, version, time.Now().UTC().Format(time.RFC3339))
	return err
}

func markAppliedTx(tx *sql.Tx, version string) error {
	_, err := tx.Exec(`INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)`, version, time.Now().UTC().Format(time.RFC3339))
	return err
}

func tableExists(db *sql.DB, table string) (bool, error) {
	var count int
	err := db.QueryRow(`SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name = ?`, table).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func hasUserTables(db *sql.DB) (bool, error) {
	var count int
	err := db.QueryRow(`SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'schema_migrations'`).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func countTableRows(ctx context.Context, db *sql.DB, table string) (int, error) {
	query := fmt.Sprintf("SELECT COUNT(*) FROM %s", table)
	var count int
	if err := db.QueryRowContext(ctx, query).Scan(&count); err != nil {
		return 0, err
	}
	return count, nil
}

func classifyMigration(source fs.FS, file string) (migrationKind, string, error) {
	firstLine, err := firstSQLLine(source, file)
	if err != nil {
		return migrationUnknown, "", err
	}
	if firstLine == "" {
		return migrationUnknown, "", nil
	}
	upper := strings.ToUpper(firstLine)
	if strings.HasPrefix(upper, "CREATE TABLE") {
		return migrationCreateTable, extractTableName(firstLine, "CREATE TABLE"), nil
	}
	if strings.HasPrefix(upper, "INSERT INTO") {
		return migrationInsert, extractTableName(firstLine, "INSERT INTO"), nil
	}
	return migrationUnknown, "", nil
}

func firstSQLLine(source fs.FS, file string) (string, error) {
	f, err := source.Open(file)
	if err != nil {
		return "", err
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "--") {
			continue
		}
		return line, nil
	}
	return "", scanner.Err()
}

func extractTableName(line string, prefix string) string {
	trimmed := strings.TrimSpace(line[len(prefix):])
	trimmed = strings.TrimPrefix(strings.TrimSpace(trimmed), "IF NOT EXISTS")
	trimmed = strings.TrimSpace(trimmed)
	if strings.HasPrefix(trimmed, "public.") {
		trimmed = strings.TrimPrefix(trimmed, "public.")
	}
	parts := strings.Fields(trimmed)
	if len(parts) == 0 {
		return ""
	}
	table := strings.Trim(parts[0], "\"`")
	table = strings.TrimPrefix(table, "public.")
	return table
}

func execStatements(ctx context.Context, tx *sql.Tx, content string) error {
	statements := strings.Split(content, ";")
	for _, stmt := range statements {
		trimmed := strings.TrimSpace(stmt)
		if trimmed == "" || strings.HasPrefix(trimmed, "--") {
			continue
		}
		if _, err := tx.ExecContext(ctx, trimmed); err != nil {
			return err
		}
	}
	return nil
}

func execInsertFile(tx *sql.Tx, source fs.FS, file string) error {
	f, err := source.Open(file)
	if err != nil {
		return err
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
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
