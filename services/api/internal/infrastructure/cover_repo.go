package infrastructure

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"services/api/domain/entities"
	"time"
)

type CoverRepository interface {
	ListCovers(ctx context.Context) ([]entities.SermonCoverSummary, error)
	GetCover(ctx context.Context, id string) (*entities.SermonCover, error)
	UpsertCover(ctx context.Context, payload entities.SermonCoverPayload) (*entities.SermonCover, error)
	DeleteCover(ctx context.Context, id string) error
}

type CoverRepo struct {
	db *sql.DB
}

func NewCoverRepo(db *sql.DB) CoverRepository {
	return &CoverRepo{db: db}
}

func (r *CoverRepo) ListCovers(ctx context.Context) ([]entities.SermonCoverSummary, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT id, title, updated_at FROM sermon_covers ORDER BY updated_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []entities.SermonCoverSummary{}
	for rows.Next() {
		var item entities.SermonCoverSummary
		if err := rows.Scan(&item.ID, &item.Title, &item.UpdatedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

func (r *CoverRepo) GetCover(ctx context.Context, id string) (*entities.SermonCover, error) {
	row := r.db.QueryRowContext(ctx, `SELECT id, title, subtitle, speaker, date_label, background, settings_json, design_json, assets_json, created_at, updated_at FROM sermon_covers WHERE id = ?`, id)
	var cover entities.SermonCover
	var settingsJSON string
	var designJSON string
	var assetsJSON string
	if err := row.Scan(
		&cover.ID,
		&cover.Title,
		&cover.Subtitle,
		&cover.Speaker,
		&cover.DateLabel,
		&cover.Background,
		&settingsJSON,
		&designJSON,
		&assetsJSON,
		&cover.CreatedAt,
		&cover.UpdatedAt,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, err
		}
		return nil, err
	}
	if err := json.Unmarshal([]byte(settingsJSON), &cover.Settings); err != nil {
		return nil, fmt.Errorf("invalid settings json: %w", err)
	}
	if designJSON != "" && designJSON != "null" && designJSON != "{}" {
		cover.Design = json.RawMessage(designJSON)
	}
	if assetsJSON != "" && assetsJSON != "null" && assetsJSON != "[]" {
		if err := json.Unmarshal([]byte(assetsJSON), &cover.Assets); err != nil {
			return nil, fmt.Errorf("invalid assets json: %w", err)
		}
	}
	return &cover, nil
}

func (r *CoverRepo) UpsertCover(ctx context.Context, payload entities.SermonCoverPayload) (*entities.SermonCover, error) {
	if payload.Title == "" {
		return nil, errors.New("title is required")
	}
	settingsJSON, err := json.Marshal(payload.Settings)
	if err != nil {
		return nil, fmt.Errorf("marshal settings: %w", err)
	}
	designJSON := ""
	if len(payload.Design) > 0 {
		designJSON = string(payload.Design)
	}
	assetsJSON := ""
	if len(payload.Assets) > 0 {
		encoded, err := json.Marshal(payload.Assets)
		if err != nil {
			return nil, fmt.Errorf("marshal assets: %w", err)
		}
		assetsJSON = string(encoded)
	}
	now := time.Now().UTC().Format(time.RFC3339)
	createdAt := now
	if payload.ID != "" {
		var existingCreated string
		err := r.db.QueryRowContext(ctx, `SELECT created_at FROM sermon_covers WHERE id = ?`, payload.ID).Scan(&existingCreated)
		if err == nil {
			createdAt = existingCreated
		}
	}

	_, err = r.db.ExecContext(
		ctx,
		`INSERT INTO sermon_covers (id, title, subtitle, speaker, date_label, background, settings_json, design_json, assets_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET title = excluded.title, subtitle = excluded.subtitle, speaker = excluded.speaker, date_label = excluded.date_label, background = excluded.background, settings_json = excluded.settings_json, design_json = excluded.design_json, assets_json = excluded.assets_json, updated_at = excluded.updated_at`,
		payload.ID,
		payload.Title,
		payload.Subtitle,
		payload.Speaker,
		payload.DateLabel,
		payload.Background,
		string(settingsJSON),
		designJSON,
		assetsJSON,
		createdAt,
		now,
	)
	if err != nil {
		return nil, err
	}

	return r.GetCover(ctx, payload.ID)
}

func (r *CoverRepo) DeleteCover(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM sermon_covers WHERE id = ?`, id)
	return err
}
