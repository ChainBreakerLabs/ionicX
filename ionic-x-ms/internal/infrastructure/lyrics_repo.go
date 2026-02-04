package infrastructure

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"ionic-x-ms/domain/entities"
	"time"
)

type LyricsRepository interface {
	ListSongs(ctx context.Context) ([]entities.LyricsSongSummary, error)
	GetSong(ctx context.Context, id string) (*entities.LyricsSong, error)
	UpsertSong(ctx context.Context, payload entities.LyricsSongPayload) (*entities.LyricsSong, error)
	DeleteSong(ctx context.Context, id string) error
}

type LyricsRepo struct {
	db *sql.DB
}

func NewLyricsRepo(db *sql.DB) LyricsRepository {
	return &LyricsRepo{db: db}
}

func (r *LyricsRepo) ListSongs(ctx context.Context) ([]entities.LyricsSongSummary, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT id, title, updated_at FROM lyrics_songs ORDER BY updated_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	songs := []entities.LyricsSongSummary{}
	for rows.Next() {
		var item entities.LyricsSongSummary
		if err := rows.Scan(&item.ID, &item.Title, &item.UpdatedAt); err != nil {
			return nil, err
		}
		songs = append(songs, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return songs, nil
}

func (r *LyricsRepo) GetSong(ctx context.Context, id string) (*entities.LyricsSong, error) {
	row := r.db.QueryRowContext(ctx, `SELECT id, title, lyrics, segments_json, settings_json, created_at, updated_at FROM lyrics_songs WHERE id = ?`, id)
	var song entities.LyricsSong
	var segmentsJSON string
	var settingsJSON string
	if err := row.Scan(&song.ID, &song.Title, &song.Lyrics, &segmentsJSON, &settingsJSON, &song.CreatedAt, &song.UpdatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, err
		}
		return nil, err
	}
	if err := json.Unmarshal([]byte(segmentsJSON), &song.Segments); err != nil {
		return nil, fmt.Errorf("invalid segments json: %w", err)
	}
	if err := json.Unmarshal([]byte(settingsJSON), &song.Settings); err != nil {
		return nil, fmt.Errorf("invalid settings json: %w", err)
	}
	return &song, nil
}

func (r *LyricsRepo) UpsertSong(ctx context.Context, payload entities.LyricsSongPayload) (*entities.LyricsSong, error) {
	if payload.Title == "" {
		return nil, errors.New("title is required")
	}

	segmentsJSON, err := json.Marshal(payload.Segments)
	if err != nil {
		return nil, fmt.Errorf("marshal segments: %w", err)
	}
	settingsJSON, err := json.Marshal(payload.Settings)
	if err != nil {
		return nil, fmt.Errorf("marshal settings: %w", err)
	}

	now := time.Now().UTC().Format(time.RFC3339)
	createdAt := now
	if payload.ID != "" {
		var existingCreated string
		err := r.db.QueryRowContext(ctx, `SELECT created_at FROM lyrics_songs WHERE id = ?`, payload.ID).Scan(&existingCreated)
		if err == nil {
			createdAt = existingCreated
		}
	}

	_, err = r.db.ExecContext(
		ctx,
		`INSERT INTO lyrics_songs (id, title, lyrics, segments_json, settings_json, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT(id) DO UPDATE SET title = excluded.title, lyrics = excluded.lyrics, segments_json = excluded.segments_json, settings_json = excluded.settings_json, updated_at = excluded.updated_at`,
		payload.ID,
		payload.Title,
		payload.Lyrics,
		string(segmentsJSON),
		string(settingsJSON),
		createdAt,
		now,
	)
	if err != nil {
		return nil, err
	}

	return r.GetSong(ctx, payload.ID)
}

func (r *LyricsRepo) DeleteSong(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM lyrics_songs WHERE id = ?`, id)
	return err
}
