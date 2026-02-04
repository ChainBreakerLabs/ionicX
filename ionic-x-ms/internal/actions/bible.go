package actions

import (
	"context"
	"ionic-x-ms/domain/entities"
	"ionic-x-ms/internal/infrastructure"
)

//go:generate mockgen -source=./bible.go -destination=./mocks/bible.go -package=mocks

type BibleAction struct {
	Db infrastructure.DatabaseGetter
}

type BibleActionInterface interface {
	VerifyBibleReference(ctx context.Context, request entities.RequestBible) (bool, error)
	GetBibleReferences(ctx context.Context, request entities.RequestBible) (*entities.Chapter, error)
	SearchVerses(ctx context.Context, terms []string, version int, limit int) ([]entities.VerseMatch, error)
}

func NewBibleAction(db infrastructure.DatabaseGetter) BibleActionInterface {
	return &BibleAction{
		Db: db,
	}
}

func (b *BibleAction) VerifyBibleReference(ctx context.Context, request entities.RequestBible) (bool, error) {
	return b.Db.VerifyBibleReference(ctx, request)
}

func (b *BibleAction) GetBibleReferences(ctx context.Context, request entities.RequestBible) (*entities.Chapter, error) {
	return b.Db.GetBibleReferences(ctx, request)
}

func (b *BibleAction) SearchVerses(ctx context.Context, terms []string, version int, limit int) ([]entities.VerseMatch, error) {
	return b.Db.SearchVerses(ctx, terms, version, limit)
}
