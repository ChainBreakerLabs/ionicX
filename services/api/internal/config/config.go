package config

import (
	"fmt"
	"net"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
)

type SQLiteConfig struct {
	Path       string
	BundlePath string
}

type Config struct {
	AppName            string
	AppDataDir         string
	SQLite             SQLiteConfig
	HTTPAddr           string
	Port               int
	PathPrefix         string
	StaticDir          string
	UploadDir          string
	LogDir             string
	LogLevel           string
	OpenBrowser        bool
	CORSAllowAll       bool
	CORSAllowedOrigins []string
}

func Load() Config {
	appName := env("APP_NAME", "ionicX")
	appDataDir := env("APP_DATA_DIR", "")
	if appDataDir == "" {
		appDataDir = defaultDataDir(appName)
	}

	httpAddr := env("HTTP_ADDR", "")
	port := envInt("PORT", 3000)
	if httpAddr == "" {
		host := env("HTTP_HOST", "127.0.0.1")
		httpAddr = fmt.Sprintf("%s:%d", host, port)
	} else {
		if _, parsedPort, err := net.SplitHostPort(httpAddr); err == nil {
			if parsed, err := strconv.Atoi(parsedPort); err == nil {
				port = parsed
			}
		}
	}

	cfg := Config{
		AppName:      appName,
		AppDataDir:   appDataDir,
		HTTPAddr:     httpAddr,
		Port:         port,
		PathPrefix:   env("PATH_PREFIX", "/ionicx"),
		StaticDir:    env("STATIC_DIR", ""),
		UploadDir:    env("UPLOAD_DIR", ""),
		LogDir:       env("LOG_DIR", ""),
		LogLevel:     env("LOG_LEVEL", "info"),
		OpenBrowser:  envBool("OPEN_BROWSER", false),
		CORSAllowAll: envBool("CORS_ALLOW_ALL", false),
		CORSAllowedOrigins: splitEnvList(
			env("CORS_ALLOWED_ORIGINS", ""),
		),
		SQLite: SQLiteConfig{
			Path:       env("SQLITE_PATH", ""),
			BundlePath: env("SQLITE_BUNDLE_PATH", ""),
		},
	}

	if cfg.SQLite.Path == "" {
		cfg.SQLite.Path = filepath.Join(cfg.AppDataDir, "app.db")
	}

	if cfg.UploadDir == "" {
		cfg.UploadDir = filepath.Join(cfg.AppDataDir, "uploads")
	}

	if cfg.LogDir == "" {
		cfg.LogDir = filepath.Join(cfg.AppDataDir, "logs")
	}

	if cfg.StaticDir == "" {
		cfg.StaticDir = defaultStaticDir()
	}

	return cfg
}

func defaultStaticDir() string {
	execDir := executableDir()
	candidates := []string{
		filepath.Join(execDir, "public"),
		filepath.Join(execDir, "web"),
		filepath.Join(execDir, "dist"),
		filepath.Join(execDir, "resources", "public"),
	}

	for _, candidate := range candidates {
		if dirExists(candidate) {
			return candidate
		}
	}

	if dirExists(filepath.Join("apps", "web", "dist")) {
		return filepath.Join("apps", "web", "dist")
	}

	return ""
}

func defaultDataDir(appName string) string {
	home, err := os.UserHomeDir()
	if err != nil {
		return filepath.Join(os.TempDir(), appName)
	}

	switch runtime.GOOS {
	case "windows":
		if appData := os.Getenv("APPDATA"); appData != "" {
			return filepath.Join(appData, appName)
		}
	case "darwin":
		return filepath.Join(home, "Library", "Application Support", appName)
	default:
		if xdg := os.Getenv("XDG_DATA_HOME"); xdg != "" {
			return filepath.Join(xdg, appName)
		}
		return filepath.Join(home, ".local", "share", appName)
	}

	return filepath.Join(home, appName)
}

func executableDir() string {
	path, err := os.Executable()
	if err != nil {
		return "."
	}
	return filepath.Dir(path)
}

func dirExists(path string) bool {
	info, err := os.Stat(path)
	if err != nil {
		return false
	}
	return info.IsDir()
}

func env(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}

func envBool(key string, fallback bool) bool {
	value := strings.TrimSpace(strings.ToLower(os.Getenv(key)))
	if value == "" {
		return fallback
	}
	return value == "1" || value == "true" || value == "yes"
}

func envInt(key string, fallback int) int {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func splitEnvList(value string) []string {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	parts := strings.Split(value, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}
