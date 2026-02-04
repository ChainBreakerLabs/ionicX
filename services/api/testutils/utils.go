package testutils

import (
	"net/http"
	"net/http/httptest"

	"services/api/internal/handlers"

	"github.com/labstack/echo/v4"
)

func ServerWithMiddlewares(h handlers.Handler, req *http.Request, mws map[string]echo.MiddlewareFunc) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()

	e := echo.New()
	g := e.Group("")
	h.RegisterRoutes(g, mws)

	e.ServeHTTP(rec, req)

	return rec
}
