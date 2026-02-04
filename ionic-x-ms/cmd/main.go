package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	stdlog "log"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"ionic-x-ms/internal/actions"
	"ionic-x-ms/internal/config"
	"ionic-x-ms/internal/dbmigrate"
	"ionic-x-ms/internal/handlers"
	"ionic-x-ms/internal/infrastructure"
	"ionic-x-ms/migrations"
	"ionic-x-ms/pkg/sqlite"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/labstack/gommon/log"
)

const (
	maxUploadSize = 1024 * 1024 * 1024 // 1 GB
)

func main() {
	cfg := config.Load()
	startedAt := time.Now().UTC()
	logWriter, closeLogs := setupLogging(cfg)
	defer closeLogs()
	log.SetOutput(logWriter)
	log.SetLevel(parseLogLevel(cfg.LogLevel))

	server := echo.New()
	server.Server.ErrorLog = stdlog.New(&filteredWriter{out: logWriter}, "echo", 0)
	applyCORS(cfg, server)
	applyRequestLogging(server)

	// Configurar el límite de tamaño del cuerpo
	server.Use(middleware.BodyLimit(fmt.Sprintf("%dM", maxUploadSize/(1024*1024))))

	// Aumentar el tiempo de espera de lectura y escritura
	server.Server.ReadTimeout = 300 * time.Second
	server.Server.WriteTimeout = 300 * time.Second

	db, err := openDatabase(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer func() {
		if err := db.Close(); err != nil {
			log.Errorf("cannot close database: %v", err)
		}
	}()

	pathPrefix := normalizePrefix(cfg.PathPrefix)
	apiPrefix := "/api" + pathPrefix
	if err := runMigrations(db); err != nil {
		log.Fatal(err)
	}

	bibleRepository := infrastructure.NewBibleRepo(db)
	bibleAction := actions.NewBibleAction(bibleRepository)
	lyricsRepository := infrastructure.NewLyricsRepo(db)
	lyricsAction := actions.NewLyricsAction(lyricsRepository)
	coverRepository := infrastructure.NewCoverRepo(db)
	coverAction := actions.NewCoverAction(coverRepository)
	videoUploadPath := filepath.Join(cfg.UploadDir, "videos")
	imageUploadPath := filepath.Join(cfg.UploadDir, "images")
	bibleHandler := handlers.NewBibleHandler(bibleAction, videoUploadPath, imageUploadPath, apiPrefix)
	lyricsHandler := handlers.NewLyricsHandler(lyricsAction)
	coverHandler := handlers.NewCoverHandler(coverAction)

	logDatabaseConfig(cfg)
	logDatabaseSummary(db)

	router := server.Group(pathPrefix)
	apiRouter := server.Group(apiPrefix)
	bibleHandler.RegisterRoutes(router, nil)
	bibleHandler.RegisterRoutes(apiRouter, nil)
	lyricsHandler.RegisterRoutes(router, nil)
	lyricsHandler.RegisterRoutes(apiRouter, nil)
	coverHandler.RegisterRoutes(router, nil)
	coverHandler.RegisterRoutes(apiRouter, nil)

	server.GET("/ws", handlers.HandleWebSocket)

	registerVideoRoutes(router, videoUploadPath)
	registerVideoRoutes(apiRouter, videoUploadPath)
	registerImageRoutes(router, imageUploadPath)
	registerImageRoutes(apiRouter, imageUploadPath)
	registerShutdownRoute(server, apiRouter)

	defer handlers.CleanupUploadedVideos(videoUploadPath)

	if cfg.StaticDir != "" {
		registerSPA(server, cfg.StaticDir)
	}

	if cfg.OpenBrowser {
		openURL := buildLocalURL(cfg.HTTPAddr)
		go func() {
			time.Sleep(600 * time.Millisecond)
			if err := openBrowser(openURL); err != nil {
				log.Warnf("cannot open browser: %v", err)
			}
		}()
	}

	listener, actualAddr, port, err := bindListener(cfg.HTTPAddr)
	if err != nil {
		log.Fatal(err)
	}
	cfg.HTTPAddr = actualAddr
	cfg.Port = port
	if err := writeRuntimeInfo(cfg, startedAt); err != nil {
		log.Warnf("cannot write runtime info: %v", err)
	}

	registerHealthRoute(server, db, cfg, startedAt)

	log.Infof("Server listening on %s", cfg.HTTPAddr)
	if err := server.Server.Serve(listener); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}

func applyCORS(cfg config.Config, server *echo.Echo) {
	if cfg.CORSAllowAll {
		server.Use(middleware.CORSWithConfig(middleware.CORSConfig{
			AllowOrigins: []string{"*"},
			AllowMethods: []string{echo.GET, echo.POST, echo.PUT, echo.DELETE},
		}))
		return
	}

	if len(cfg.CORSAllowedOrigins) > 0 {
		server.Use(middleware.CORSWithConfig(middleware.CORSConfig{
			AllowOrigins: cfg.CORSAllowedOrigins,
			AllowMethods: []string{echo.GET, echo.POST, echo.PUT, echo.DELETE},
		}))
		return
	}

	server.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOriginFunc: func(origin string) (bool, error) {
			return isLocalOrigin(origin), nil
		},
		AllowMethods: []string{echo.GET, echo.POST, echo.PUT, echo.DELETE},
	}))
}

func applyRequestLogging(server *echo.Echo) {
	server.Use(middleware.RequestLoggerWithConfig(middleware.RequestLoggerConfig{
		LogMethod:    true,
		LogURI:       true,
		LogStatus:    true,
		LogLatency:   true,
		LogRemoteIP:  true,
		LogRoutePath: true,
		LogError:     true,
		HandleError:  true,
		LogValuesFunc: func(c echo.Context, v middleware.RequestLoggerValues) error {
			if v.Error != nil {
				if strings.Contains(v.Error.Error(), "hijacked") {
					return nil
				}
				log.Warnf(
					"request method=%s uri=%s status=%d latency=%s remote_ip=%s route=%s error=%v",
					v.Method, v.URI, v.Status, v.Latency, v.RemoteIP, v.RoutePath, v.Error,
				)
				return nil
			}

			log.Infof(
				"request method=%s uri=%s status=%d latency=%s remote_ip=%s route=%s",
				v.Method, v.URI, v.Status, v.Latency, v.RemoteIP, v.RoutePath,
			)
			return nil
		},
	}))
}

type filteredWriter struct {
	out io.Writer
}

func (w *filteredWriter) Write(p []byte) (int, error) {
	if bytes.Contains(p, []byte("hijacked")) {
		return len(p), nil
	}
	return w.out.Write(p)
}

func openDatabase(cfg config.Config) (*sql.DB, error) {
	path, err := ensureSQLiteFile(cfg)
	if err != nil {
		return nil, err
	}

	db, err := sqlite.Open(path)
	if err != nil {
		return nil, err
	}

	return db, nil
}

func runMigrations(db *sql.DB) error {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	if err := dbmigrate.Run(ctx, db, migrations.FS); err != nil {
		return fmt.Errorf("migrations failed: %w", err)
	}
	return nil
}

func logDatabaseConfig(cfg config.Config) {
	log.Infof("DB mode=sqlite path=%s", cfg.SQLite.Path)
}

func logDatabaseSummary(db *sql.DB) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		log.Warnf("db ping failed: %v", err)
	} else {
		log.Infof("db ping ok")
	}

	tables := []string{
		"bibles",
		"books",
		"chapters",
		"verses",
		"chapters_verses",
		"lyrics_songs",
		"sermon_covers",
	}

	for _, table := range tables {
		count, err := countTableRows(ctx, db, table)
		if err != nil {
			log.Warnf("db table check failed table=%s err=%v", table, err)
			continue
		}
		log.Infof("db table=%s rows=%d", table, count)
		if count == 0 {
			log.Warnf("db table=%s empty: verify migrations/seeds ran", table)
		}
	}
}

func countTableRows(ctx context.Context, db *sql.DB, table string) (int, error) {
	query := fmt.Sprintf("SELECT COUNT(*) FROM %s", table)
	var count int
	if err := db.QueryRowContext(ctx, query).Scan(&count); err != nil {
		return 0, err
	}
	return count, nil
}

func normalizePrefix(prefix string) string {
	if prefix == "" {
		return ""
	}
	if !strings.HasPrefix(prefix, "/") {
		prefix = "/" + prefix
	}
	return strings.TrimRight(prefix, "/")
}

func registerVideoRoutes(router *echo.Group, uploadPath string) {
	router.GET("/videos/*", func(c echo.Context) error {
		filePath := filepath.Join(fmt.Sprintf("%s/", uploadPath), c.Param("*"))

		// Verificar si el archivo existe
		if _, err := os.Stat(filePath); os.IsNotExist(err) {
			return c.String(http.StatusNotFound, "File not found")
		}

		return c.File(filePath)
	})
}

func registerImageRoutes(router *echo.Group, uploadPath string) {
	router.GET("/images/*", func(c echo.Context) error {
		filePath := filepath.Join(fmt.Sprintf("%s/", uploadPath), c.Param("*"))

		if _, err := os.Stat(filePath); os.IsNotExist(err) {
			return c.String(http.StatusNotFound, "File not found")
		}

		return c.File(filePath)
	})
}

func registerShutdownRoute(server *echo.Echo, router *echo.Group) {
	router.POST("/shutdown", func(c echo.Context) error {
		go func() {
			time.Sleep(200 * time.Millisecond)
			if err := server.Shutdown(context.Background()); err != nil {
				log.Errorf("shutdown failed: %v", err)
			}
		}()
		return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
	})
}

func registerHealthRoute(server *echo.Echo, db *sql.DB, cfg config.Config, startedAt time.Time) {
	server.GET("/health", func(c echo.Context) error {
		ctx, cancel := context.WithTimeout(c.Request().Context(), 2*time.Second)
		defer cancel()

		status := "ok"
		dbStatus := "ok"
		if err := db.PingContext(ctx); err != nil {
			status = "error"
			dbStatus = err.Error()
		}

		payload := map[string]any{
			"status":      status,
			"db":          dbStatus,
			"port":        cfg.Port,
			"dataDir":     cfg.AppDataDir,
			"logDir":      cfg.LogDir,
			"pathPrefix":  cfg.PathPrefix,
			"appName":     cfg.AppName,
			"serverAddr":  cfg.HTTPAddr,
			"startedAt":   startedAt.Format(time.RFC3339),
			"serverReady": status == "ok",
		}

		if status != "ok" {
			return c.JSON(http.StatusServiceUnavailable, payload)
		}
		return c.JSON(http.StatusOK, payload)
	})
}

func registerSPA(server *echo.Echo, staticDir string) {
	fileServer := http.FileServer(http.Dir(staticDir))

	server.GET("/*", func(c echo.Context) error {
		requestPath := filepath.Clean(c.Request().URL.Path)
		if strings.HasPrefix(requestPath, "/") {
			requestPath = requestPath[1:]
		}
		candidate := filepath.Join(staticDir, requestPath)

		if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
			fileServer.ServeHTTP(c.Response(), c.Request())
			return nil
		}

		indexPath := filepath.Join(staticDir, "index.html")
		return c.File(indexPath)
	})
}

func buildLocalURL(addr string) string {
	host, port, err := net.SplitHostPort(addr)
	if err != nil || port == "" {
		return "http://127.0.0.1:3000"
	}

	if host == "" || host == "0.0.0.0" || host == "::" {
		host = "127.0.0.1"
	}

	return fmt.Sprintf("http://%s:%s", host, port)
}

func openBrowser(url string) error {
	var cmd *exec.Cmd

	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", url)
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}

	return cmd.Start()
}

func ensureSQLiteFile(cfg config.Config) (string, error) {
	if fileExists(cfg.SQLite.Path) {
		return cfg.SQLite.Path, nil
	}

	if err := os.MkdirAll(filepath.Dir(cfg.SQLite.Path), 0o755); err != nil {
		return "", fmt.Errorf("cannot create sqlite directory: %w", err)
	}

	source := cfg.SQLite.BundlePath
	if source == "" {
		source = findBundledSQLite()
	}
	if source != "" {
		if err := copyFile(source, cfg.SQLite.Path); err != nil {
			return "", err
		}
		return cfg.SQLite.Path, nil
	}

	file, err := os.Create(cfg.SQLite.Path)
	if err != nil {
		return "", fmt.Errorf("cannot create sqlite file: %w", err)
	}
	if err := file.Close(); err != nil {
		return "", fmt.Errorf("cannot close sqlite file: %w", err)
	}

	return cfg.SQLite.Path, nil
}

func findBundledSQLite() string {
	execPath, err := os.Executable()
	if err != nil {
		return ""
	}
	execDir := filepath.Dir(execPath)

	candidates := []string{
		filepath.Join(execDir, "bible.sqlite"),
		filepath.Join(execDir, "resources", "bible.sqlite"),
		filepath.Join(execDir, "dist", "db", "bible.sqlite"),
		filepath.Join("dist", "db", "bible.sqlite"),
	}

	for _, candidate := range candidates {
		if fileExists(candidate) {
			if info, err := os.Stat(candidate); err == nil && info.Size() > 0 {
				return candidate
			}
		}
	}

	return ""
}

func copyFile(source string, destination string) error {
	src, err := os.Open(source)
	if err != nil {
		return fmt.Errorf("cannot open sqlite bundle: %w", err)
	}
	defer src.Close()

	dst, err := os.Create(destination)
	if err != nil {
		return fmt.Errorf("cannot create sqlite destination: %w", err)
	}
	defer dst.Close()

	if _, err := io.Copy(dst, src); err != nil {
		return fmt.Errorf("cannot copy sqlite file: %w", err)
	}

	return nil
}

func fileExists(path string) bool {
	info, err := os.Stat(path)
	if err != nil {
		return false
	}
	return !info.IsDir()
}

func setupLogging(cfg config.Config) (io.Writer, func()) {
	if err := os.MkdirAll(cfg.LogDir, 0o755); err != nil {
		return os.Stdout, func() {}
	}

	logPath := filepath.Join(cfg.LogDir, "ionicx.log")
	file, err := os.OpenFile(logPath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return os.Stdout, func() {}
	}

	writer := io.MultiWriter(os.Stdout, file)
	return writer, func() { _ = file.Close() }
}

func parseLogLevel(level string) log.Lvl {
	switch strings.ToLower(strings.TrimSpace(level)) {
	case "debug":
		return log.DEBUG
	case "warn", "warning":
		return log.WARN
	case "error":
		return log.ERROR
	default:
		return log.INFO
	}
}

func bindListener(addr string) (net.Listener, string, int, error) {
	listener, err := net.Listen("tcp", addr)
	if err != nil {
		return nil, "", 0, err
	}
	actualAddr := listener.Addr().String()
	port := 0
	if tcpAddr, ok := listener.Addr().(*net.TCPAddr); ok {
		port = tcpAddr.Port
	}
	return listener, actualAddr, port, nil
}

type runtimeInfo struct {
	Port       int    `json:"port"`
	Addr       string `json:"addr"`
	AppDataDir string `json:"appDataDir"`
	LogDir     string `json:"logDir"`
	StartedAt  string `json:"startedAt"`
}

func writeRuntimeInfo(cfg config.Config, startedAt time.Time) error {
	info := runtimeInfo{
		Port:       cfg.Port,
		Addr:       cfg.HTTPAddr,
		AppDataDir: cfg.AppDataDir,
		LogDir:     cfg.LogDir,
		StartedAt:  startedAt.Format(time.RFC3339),
	}
	data, err := json.MarshalIndent(info, "", "  ")
	if err != nil {
		return err
	}
	path := filepath.Join(cfg.AppDataDir, "runtime.json")
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

func isLocalOrigin(origin string) bool {
	trimmed := strings.TrimSpace(origin)
	if trimmed == "" || strings.EqualFold(trimmed, "null") {
		return true
	}
	parsed, err := url.Parse(origin)
	if err != nil {
		return false
	}
	host := strings.ToLower(parsed.Hostname())
	switch parsed.Scheme {
	case "tauri":
		return host == "localhost"
	case "http", "https":
		return host == "localhost" || host == "127.0.0.1" || host == "tauri.localhost"
	default:
		return false
	}
}
