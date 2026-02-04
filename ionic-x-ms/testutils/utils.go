package testutils

import (
	"github.com/labstack/echo/v4"
	"ionic-x-ms/internal/handlers"
	"net/http"
	"net/http/httptest"
)

func ServerWithMiddlewares(h handlers.Handler, req *http.Request, mws map[string]echo.MiddlewareFunc) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()

	e := echo.New()
	g := e.Group("")
	h.RegisterRoutes(g, mws)

	e.ServeHTTP(rec, req)

	return rec
}
