package handlers

import (
	"fmt"
	"github.com/labstack/echo/v4"
	"github.com/labstack/gommon/log"
	"io"
	"ionic-x-ms/domain/entities"
	"ionic-x-ms/internal/actions"
	"ionic-x-ms/lib"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
	"unicode"
)

type BibleHandler struct {
	action          actions.BibleActionInterface
	videoUploadPath string
	imageUploadPath string
	apiBasePath     string
}

func NewBibleHandler(action actions.BibleActionInterface, videoUploadPath string, imageUploadPath string, apiBasePath string) *BibleHandler {
	return &BibleHandler{
		action:          action,
		videoUploadPath: videoUploadPath,
		imageUploadPath: imageUploadPath,
		apiBasePath:     apiBasePath,
	}
}

func (b *BibleHandler) RegisterRoutes(router *echo.Group, mws map[string]echo.MiddlewareFunc) {
	router.GET("/v1/bible/search", b.SearchVerses)
	router.GET("/v1/bible/:book/:chapter/verify", b.VerifyBibleReference)
	router.GET("/v1/bible/:book/:chapter", b.GetBibleReferences)
	router.POST("/upload-video", b.UploadVideo)
	router.POST("/upload-image", b.UploadImage)
}

func (b *BibleHandler) GetBibleReferences(c echo.Context) error {
	ctx := c.Request().Context()

	req := entities.RequestBible{}
	if err := lib.Bind(c, &req); err != nil {
		log.Warnf("bind GetBibleReferences failed: %v", err)
		return c.JSON(http.StatusBadRequest, err)
	}

	response, err := b.action.GetBibleReferences(ctx, req)
	if err != nil {
		log.Warnf("GetBibleReferences failed book=%s chapter=%d version=%d offset=%d limit=%d err=%v",
			req.Book, req.Chapter, req.Version, req.Offset, req.Limit, err)
		return c.JSON(http.StatusNotFound, err)
	}

	return c.JSON(http.StatusOK, response)
}

func (b *BibleHandler) VerifyBibleReference(c echo.Context) error {
	ctx := c.Request().Context()

	req := entities.RequestBible{}
	if err := lib.Bind(c, &req); err != nil {
		log.Warnf("bind VerifyBibleReference failed: %v", err)
		return c.JSON(http.StatusBadRequest, err)
	}

	response, err := b.action.VerifyBibleReference(ctx, req)
	if err != nil {
		log.Warnf("VerifyBibleReference failed book=%s chapter=%d version=%d offset=%d limit=%d err=%v",
			req.Book, req.Chapter, req.Version, req.Offset, req.Limit, err)
		return c.JSON(http.StatusNotFound, err.Error())
	}

	return c.JSON(http.StatusOK, response)
}

func (b *BibleHandler) SearchVerses(c echo.Context) error {
	ctx := c.Request().Context()

	req := entities.RequestSearch{}
	if err := lib.Bind(c, &req); err != nil {
		log.Warnf("bind SearchVerses failed: %v", err)
		return c.JSON(http.StatusBadRequest, err)
	}

	terms := tokenizeSearchQuery(strings.TrimSpace(req.Query))
	if len(terms) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "query is required"})
	}
	if len(terms) > 5 {
		terms = terms[:5]
	}

	response, err := b.action.SearchVerses(ctx, terms, req.Version, req.Limit)
	if err != nil {
		log.Warnf("SearchVerses failed q=%q version=%d limit=%d err=%v", req.Query, req.Version, req.Limit, err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "search failed"})
	}

	return c.JSON(http.StatusOK, response)
}

func (b *BibleHandler) UploadVideo(c echo.Context) error {
	file, err := c.FormFile("video")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "No video file provided"})
	}

	CleanupUploadedVideos(b.videoUploadPath)

	// Create the upload directory if it doesn't exist
	if err := os.MkdirAll(b.videoUploadPath, os.ModePerm); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to create upload directory"})
	}

	// Generate a unique filename while preserving extension for content-type detection
	ext := filepath.Ext(file.Filename)
	filename := fmt.Sprintf("%d%s", time.Now().UnixNano(), ext)
	destPath := filepath.Join(b.videoUploadPath, filename)

	// Open the source file
	src, err := file.Open()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to open uploaded file"})
	}
	defer src.Close()

	// Create the destination file
	dst, err := os.Create(destPath)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to create destination file"})
	}
	defer dst.Close()

	// Copy the uploaded file to the destination file
	if _, err = io.Copy(dst, src); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to save the file"})
	}

	// Generar la URL pública para el video (con el nombre original del archivo)
	videoURL := fmt.Sprintf("%s/videos/%s", b.apiBasePath, filename)

	return c.JSON(http.StatusOK, map[string]string{"url": videoURL})
}

func (b *BibleHandler) UploadImage(c echo.Context) error {
	file, err := c.FormFile("image")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "No image file provided"})
	}

	if err := os.MkdirAll(b.imageUploadPath, os.ModePerm); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to create upload directory"})
	}

	ext := filepath.Ext(file.Filename)
	filename := fmt.Sprintf("%d%s", time.Now().UnixNano(), ext)
	destPath := filepath.Join(b.imageUploadPath, filename)

	src, err := file.Open()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to open uploaded file"})
	}
	defer src.Close()

	dst, err := os.Create(destPath)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to create destination file"})
	}
	defer dst.Close()

	if _, err = io.Copy(dst, src); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to save the file"})
	}

	imageURL := fmt.Sprintf("%s/images/%s", b.apiBasePath, filename)
	return c.JSON(http.StatusOK, map[string]string{"url": imageURL})
}

func tokenizeSearchQuery(query string) []string {
	fields := strings.FieldsFunc(query, func(r rune) bool {
		return !(unicode.IsLetter(r) || unicode.IsNumber(r))
	})

	terms := make([]string, 0, len(fields))
	for _, field := range fields {
		trimmed := strings.TrimSpace(field)
		if len(trimmed) < 2 {
			continue
		}
		terms = append(terms, trimmed)
	}

	return terms
}
