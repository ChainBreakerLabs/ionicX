package infrastructure

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"ionic-x-ms/domain/consts"
	"ionic-x-ms/domain/entities"
	"strings"
)

type DatabaseGetter interface {
	VerifyBibleReference(ctx context.Context, request entities.RequestBible) (bool, error)
	GetBibleReferences(ctx context.Context, request entities.RequestBible) (*entities.Chapter, error)
	SearchVerses(ctx context.Context, terms []string, version int, limit int) ([]entities.VerseMatch, error)
}

type Database struct {
	db *sql.DB
}

func NewBibleRepo(db *sql.DB) DatabaseGetter {
	return &Database{
		db: db,
	}
}

func (a *Database) VerifyBibleReference(ctx context.Context, request entities.RequestBible) (bool, error) {
	if _, exist := consts.Books[request.Book]; !exist {
		return false, errors.New("notFound")
	}

	txn, err := a.db.BeginTx(ctx, nil)
	if err != nil {
		return false, err
	}
	defer txn.Rollback()

	var numberVerses int
	err = txn.QueryRowContext(
		ctx,
		verifyBibleReferenceQuery,
		request.Book,
		request.Chapter).Scan(&numberVerses)
	if err != nil {
		return false, err
	}

	if request.Offset > numberVerses && request.Limit > numberVerses {
		return false, errors.New("inValid")
	}

	return true, nil
}

func (a *Database) GetBibleReferences(ctx context.Context, request entities.RequestBible) (*entities.Chapter, error) {
	txn, err := a.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer txn.Rollback()

	query := applyPagination(biblicalReferencesQuery, request.Offset, request.Limit)

	rows, err := txn.QueryContext(
		ctx,
		query,
		request.Book,
		request.Chapter,
		request.Version)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	chapterFound := entities.Chapter{}
	verse := entities.Verse{}

	for rows.Next() {
		err = rows.Scan(&chapterFound.Name, &chapterFound.Research, &verse.Research, &verse.Index, &verse.Text)
		if err != nil {
			return nil, err
		}

		chapterFound.Verses = append(chapterFound.Verses, verse)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return &chapterFound, nil
}

func (a *Database) SearchVerses(ctx context.Context, terms []string, version int, limit int) ([]entities.VerseMatch, error) {
	if len(terms) == 0 {
		return nil, nil
	}
	if version <= 0 {
		version = 1
	}
	if limit <= 0 {
		limit = 8
	}
	if limit > 20 {
		limit = 20
	}

	query, args := buildSearchVersesQuery(terms, version, limit)

	rows, err := a.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	results := make([]entities.VerseMatch, 0, limit)
	for rows.Next() {
		var item entities.VerseMatch
		if err := rows.Scan(&item.Book, &item.Chapter, &item.Verse, &item.Text); err != nil {
			return nil, err
		}
		results = append(results, item)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return results, nil
}

const (
	verifyBibleReferenceQuery = `SELECT number_verses FROM chapters_verses WHERE book = ? AND chapter = ?`
	biblicalReferencesQuery   = `SELECT c.title, c.research, v.research, v."index", v.content 
									FROM books b INNER JOIN chapters c ON b.name = c.book INNER JOIN verses v ON c.id = v.chapter INNER JOIN bibles bl ON  bl.id = b.bible_id
        					   		WHERE b.name = ? AND c."index" = ?  AND bl.id = ? ORDER BY v."index"`
)

func applyPagination(query string, offset int, limit int) string {
	// SQLite requires LIMIT before OFFSET; OFFSET alone needs LIMIT -1.
	if limit != 0 {
		query += fmt.Sprintf(` LIMIT %d`, limit)
		if offset != 0 {
			query += fmt.Sprintf(` OFFSET %d`, offset)
		}
		return query
	}
	if offset != 0 {
		query += fmt.Sprintf(` LIMIT -1 OFFSET %d`, offset)
	}
	return query
}

var searchTermReplacer = strings.NewReplacer(
	"\u00e1", "a",
	"\u00e9", "e",
	"\u00ed", "i",
	"\u00f3", "o",
	"\u00fa", "u",
	"\u00fc", "u",
	"\u00f1", "n",
)

var searchAccentReplacements = []struct {
	from string
	to   string
}{
	{from: "\u00c1", to: "a"},
	{from: "\u00c9", to: "e"},
	{from: "\u00cd", to: "i"},
	{from: "\u00d3", to: "o"},
	{from: "\u00da", to: "u"},
	{from: "\u00dc", to: "u"},
	{from: "\u00d1", to: "n"},
	{from: "\u00e1", to: "a"},
	{from: "\u00e9", to: "e"},
	{from: "\u00ed", to: "i"},
	{from: "\u00f3", to: "o"},
	{from: "\u00fa", to: "u"},
	{from: "\u00fc", to: "u"},
	{from: "\u00f1", to: "n"},
}

func normalizeSearchTerm(term string) string {
	normalized := strings.ToLower(strings.TrimSpace(term))
	if normalized == "" {
		return ""
	}
	return searchTermReplacer.Replace(normalized)
}

func normalizedSQLiteExpr(expr string) string {
	normalized := expr
	for _, replacement := range searchAccentReplacements {
		normalized = fmt.Sprintf("replace(%s, '%s', '%s')", normalized, replacement.from, replacement.to)
	}
	return fmt.Sprintf("lower(%s)", normalized)
}

func buildSearchVersesQuery(terms []string, version int, limit int) (string, []interface{}) {
	query := `SELECT b.name, c."index", v."index", v.content
			  FROM verses v
			  INNER JOIN chapters c ON c.id = v.chapter
			  INNER JOIN books b ON b.name = c.book
			  INNER JOIN bibles bl ON bl.id = b.bible_id
			  WHERE bl.id = ?`

	args := make([]interface{}, 0, len(terms)+2)
	args = append(args, version)

	normalizedContent := normalizedSQLiteExpr("v.content")
	termCount := 0
	for _, term := range terms {
		normalizedTerm := normalizeSearchTerm(term)
		if normalizedTerm == "" {
			continue
		}
		termCount++
		query += fmt.Sprintf(" AND %s LIKE ?", normalizedContent)
		args = append(args, "%"+normalizedTerm+"%")
	}
	if termCount == 0 {
		query += " AND 1 = 0"
	}

	query += ` ORDER BY b.name, c."index", v."index" LIMIT ?`
	args = append(args, limit)

	return query, args
}
