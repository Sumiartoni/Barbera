package logger

import (
	"log/slog"
	"os"
)

func New(env string, appName string) *slog.Logger {
	level := slog.LevelInfo
	if env == "development" {
		level = slog.LevelDebug
	}

	handler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: level})
	return slog.New(handler).With("app", appName, "env", env)
}
