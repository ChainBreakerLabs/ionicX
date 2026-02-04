package actions

import (
	"context"
	"ionic-x-ms/domain/entities"
	"ionic-x-ms/internal/infrastructure"
)

type LyricsActionInterface interface {
	ListSongs(ctx context.Context) ([]entities.LyricsSongSummary, error)
	GetSong(ctx context.Context, id string) (*entities.LyricsSong, error)
	UpsertSong(ctx context.Context, payload entities.LyricsSongPayload) (*entities.LyricsSong, error)
	DeleteSong(ctx context.Context, id string) error
}

type LyricsAction struct {
	repo infrastructure.LyricsRepository
}

func NewLyricsAction(repo infrastructure.LyricsRepository) LyricsActionInterface {
	return &LyricsAction{repo: repo}
}

func (a *LyricsAction) ListSongs(ctx context.Context) ([]entities.LyricsSongSummary, error) {
	return a.repo.ListSongs(ctx)
}

func (a *LyricsAction) GetSong(ctx context.Context, id string) (*entities.LyricsSong, error) {
	return a.repo.GetSong(ctx, id)
}

func (a *LyricsAction) UpsertSong(ctx context.Context, payload entities.LyricsSongPayload) (*entities.LyricsSong, error) {
	return a.repo.UpsertSong(ctx, payload)
}

func (a *LyricsAction) DeleteSong(ctx context.Context, id string) error {
	return a.repo.DeleteSong(ctx, id)
}
