package actions

import (
	"context"
	"ionic-x-ms/domain/entities"
	"ionic-x-ms/internal/infrastructure"
)

type CoverActionInterface interface {
	ListCovers(ctx context.Context) ([]entities.SermonCoverSummary, error)
	GetCover(ctx context.Context, id string) (*entities.SermonCover, error)
	UpsertCover(ctx context.Context, payload entities.SermonCoverPayload) (*entities.SermonCover, error)
	DeleteCover(ctx context.Context, id string) error
}

type CoverAction struct {
	repo infrastructure.CoverRepository
}

func NewCoverAction(repo infrastructure.CoverRepository) CoverActionInterface {
	return &CoverAction{repo: repo}
}

func (a *CoverAction) ListCovers(ctx context.Context) ([]entities.SermonCoverSummary, error) {
	return a.repo.ListCovers(ctx)
}

func (a *CoverAction) GetCover(ctx context.Context, id string) (*entities.SermonCover, error) {
	return a.repo.GetCover(ctx, id)
}

func (a *CoverAction) UpsertCover(ctx context.Context, payload entities.SermonCoverPayload) (*entities.SermonCover, error) {
	return a.repo.UpsertCover(ctx, payload)
}

func (a *CoverAction) DeleteCover(ctx context.Context, id string) error {
	return a.repo.DeleteCover(ctx, id)
}
