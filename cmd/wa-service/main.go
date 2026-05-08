package main

import (
	"time"

	"balikcukur/pkg/config"
	"balikcukur/pkg/logger"
)

func main() {
	cfg := config.Load()
	log := logger.New(cfg.App.Env, "wa-service")
	log.Info("wa service started", "mode", "tenant-isolated")

	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		log.Info("wa service heartbeat")
	}
}
