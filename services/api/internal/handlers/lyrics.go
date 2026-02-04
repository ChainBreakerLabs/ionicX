package handlers

import (
	"fmt"
	"services/api/domain/entities"
	"services/api/internal/actions"
	"services/api/lib"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/labstack/gommon/log"
)

type LyricsHandler struct {
	action actions.LyricsActionInterface
}

func NewLyricsHandler(action actions.LyricsActionInterface) *LyricsHandler {
	return &LyricsHandler{action: action}
}

func (h *LyricsHandler) RegisterRoutes(router *echo.Group, _ map[string]echo.MiddlewareFunc) {
	router.GET("/v1/lyrics", h.ListSongs)
	router.GET("/v1/lyrics/:id", h.GetSong)
	router.POST("/v1/lyrics", h.UpsertSong)
	router.DELETE("/v1/lyrics/:id", h.DeleteSong)
}

func (h *LyricsHandler) ListSongs(c echo.Context) error {
	ctx := c.Request().Context()
	songs, err := h.action.ListSongs(ctx)
	if err != nil {
		log.Warnf("ListSongs failed err=%v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "list failed"})
	}
	return c.JSON(http.StatusOK, songs)
}

func (h *LyricsHandler) GetSong(c echo.Context) error {
	ctx := c.Request().Context()
	id := c.Param("id")
	if id == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "id is required"})
	}
	song, err := h.action.GetSong(ctx, id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "not found"})
	}
	return c.JSON(http.StatusOK, song)
}

func (h *LyricsHandler) UpsertSong(c echo.Context) error {
	ctx := c.Request().Context()
	var payload entities.LyricsSongPayload
	if err := lib.Bind(c, &payload); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid payload"})
	}
	if payload.Title == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "title is required"})
	}
	if payload.ID == "" {
		payload.ID = fmt.Sprintf("lyr-%d", time.Now().UnixNano())
	}
	song, err := h.action.UpsertSong(ctx, payload)
	if err != nil {
		log.Warnf("UpsertSong failed id=%s err=%v", payload.ID, err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "save failed"})
	}
	return c.JSON(http.StatusOK, song)
}

func (h *LyricsHandler) DeleteSong(c echo.Context) error {
	ctx := c.Request().Context()
	id := c.Param("id")
	if id == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "id is required"})
	}
	if err := h.action.DeleteSong(ctx, id); err != nil {
		log.Warnf("DeleteSong failed id=%s err=%v", id, err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "delete failed"})
	}
	return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
}
