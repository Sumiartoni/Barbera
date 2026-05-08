package main

import (
	"time"

	"balikcukur/pkg/config"
	"balikcukur/pkg/logger"
)

func main() {
	cfg := config.Load()
	log := logger.New(cfg.App.Env, "worker")
	log.Info("worker started", "queue", "reminders,campaigns,usage-reset")

	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		log.Info("worker heartbeat")
	}
}
