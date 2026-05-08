package main

import (
	"context"
	"log"
	"time"

	"balikcukur/pkg/config"
	"balikcukur/pkg/database"
)

func main() {
	cfg := config.Load()

	db, err := database.Connect(cfg.Postgres)
	if err != nil {
		log.Fatalf("connect postgres: %v", err)
	}
	defer db.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	if err := database.ApplyMigrations(ctx, db, "db/migrations"); err != nil {
		log.Fatalf("apply migrations: %v", err)
	}

	log.Println("migrations applied successfully")
}
