package handlers

import (
	"encoding/json"
	"fmt"
	"services/api/domain/entities"
	"services/api/internal/actions"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/labstack/gommon/log"
)

type CoverHandler struct {
	action actions.CoverActionInterface
}

func NewCoverHandler(action actions.CoverActionInterface) *CoverHandler {
	return &CoverHandler{action: action}
}

func (h *CoverHandler) RegisterRoutes(router *echo.Group, _ map[string]echo.MiddlewareFunc) {
	router.GET("/v1/covers", h.ListCovers)
	router.GET("/v1/covers/:id", h.GetCover)
	router.POST("/v1/covers", h.UpsertCover)
	router.DELETE("/v1/covers/:id", h.DeleteCover)
}

func (h *CoverHandler) ListCovers(c echo.Context) error {
	ctx := c.Request().Context()
	covers, err := h.action.ListCovers(ctx)
	if err != nil {
		log.Warnf("ListCovers failed err=%v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "list failed"})
	}
	return c.JSON(http.StatusOK, covers)
}

func (h *CoverHandler) GetCover(c echo.Context) error {
	ctx := c.Request().Context()
	id := c.Param("id")
	if id == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "id is required"})
	}
	cover, err := h.action.GetCover(ctx, id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "not found"})
	}
	return c.JSON(http.StatusOK, cover)
}

func (h *CoverHandler) UpsertCover(c echo.Context) error {
	ctx := c.Request().Context()
	var payload entities.SermonCoverPayload
	if err := json.NewDecoder(c.Request().Body).Decode(&payload); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid payload"})
	}
	if payload.Title == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "title is required"})
	}
	if payload.ID == "" {
		payload.ID = fmt.Sprintf("cov-%d", time.Now().UnixNano())
	}
	cover, err := h.action.UpsertCover(ctx, payload)
	if err != nil {
		log.Warnf("UpsertCover failed id=%s err=%v", payload.ID, err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "save failed"})
	}
	return c.JSON(http.StatusOK, cover)
}

func (h *CoverHandler) DeleteCover(c echo.Context) error {
	ctx := c.Request().Context()
	id := c.Param("id")
	if id == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "id is required"})
	}
	if err := h.action.DeleteCover(ctx, id); err != nil {
		log.Warnf("DeleteCover failed id=%s err=%v", id, err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "delete failed"})
	}
	return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
}
