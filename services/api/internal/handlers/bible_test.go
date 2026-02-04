package handlers_test

import (
	"errors"
	"github.com/dot-backend/synergetic-craft/clienthttp"
	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/assert"
	"services/api/domain/entities"
	"services/api/internal/actions/mocks"
	"services/api/internal/handlers"
	"services/api/testutils"
	"testing"
)

func TestBibleHandler_VerifyBibleReference(t *testing.T) {
	t.Run("should return 200 when bible reference exist", func(t *testing.T) {
		reqMock := entities.RequestBible{
			Book:    "genesis",
			Chapter: 3,
			Offset:  0,
			Limit:   10,
		}

		f := setupBibleHandlerFixture(t)
		f.expectVerifyBibleReference(reqMock, nil)

		request := clienthttp.NewRequest("GET", "/v1/bible/genesis/3/verify").
			WithQueryParam("offset", "0").
			WithQueryParam("limit", "10").
			Build()

		rec := testutils.ServerWithMiddlewares(f.handler, request, nil)

		assert.Equal(t, 200, rec.Code)
	})

	t.Run("should return 404 when bible reference not exist", func(t *testing.T) {
		reqMock := entities.RequestBible{
			Book:    "genesis",
			Chapter: 3,
			Offset:  0,
			Limit:   10,
		}

		f := setupBibleHandlerFixture(t)
		f.expectVerifyBibleReference(reqMock, errors.New("not found"))

		request := clienthttp.NewRequest("GET", "/v1/bible/genesis/3/verify").
			WithQueryParam("offset", "0").
			WithQueryParam("limit", "10").
			Build()

		rec := testutils.ServerWithMiddlewares(f.handler, request, nil)

		assert.Equal(t, 404, rec.Code)
	})
}

func TestBibleHandler_GetBibleReferences(t *testing.T) {
	t.Run("should return 200 when bible reference exist", func(t *testing.T) {
		reqMock := entities.RequestBible{
			Book:    "genesis",
			Chapter: 3,
			Offset:  0,
			Limit:   10,
		}

		f := setupBibleHandlerFixture(t)
		f.expectGetBibleReferences(reqMock, nil)

		request := clienthttp.NewRequest("GET", "/v1/bible/genesis/3").
			WithQueryParam("offset", "0").
			WithQueryParam("limit", "10").
			Build()

		rec := testutils.ServerWithMiddlewares(f.handler, request, nil)

		assert.Equal(t, 200, rec.Code)
	})

	t.Run("should return 404 when bible reference not exist", func(t *testing.T) {
		reqMock := entities.RequestBible{
			Book:    "genesis",
			Chapter: 3,
			Offset:  0,
			Limit:   10,
		}

		f := setupBibleHandlerFixture(t)
		f.expectGetBibleReferences(reqMock, errors.New("not found"))

		request := clienthttp.NewRequest("GET", "/v1/bible/genesis/3").
			WithQueryParam("offset", "0").
			WithQueryParam("limit", "10").
			Build()

		rec := testutils.ServerWithMiddlewares(f.handler, request, nil)

		assert.Equal(t, 404, rec.Code)
	})
}

type bibleHandlerFixture struct {
	handler *handlers.BibleHandler
	action  *mocks.MockBibleActionInterface
}

func setupBibleHandlerFixture(t *testing.T) *bibleHandlerFixture {
	ctrl := gomock.NewController(t)
	action := mocks.NewMockBibleActionInterface(ctrl)

	return &bibleHandlerFixture{
		handler: handlers.NewBibleHandler(action, "uploads/videos", "uploads/images", "/api/ionic-x-ms"),
		action:  action,
	}
}

func (a *bibleHandlerFixture) expectVerifyBibleReference(request entities.RequestBible, err error) {
	a.action.EXPECT().VerifyBibleReference(gomock.Any(), request).
		Return(true, err)
}

func (a *bibleHandlerFixture) expectGetBibleReferences(request entities.RequestBible, err error) {
	a.action.EXPECT().GetBibleReferences(gomock.Any(), request).
		Return(entities.Chapter{}, err)
}
