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

	if err := database.ApplySeeds(ctx, db, "db/seeds"); err != nil {
		log.Fatalf("apply seeds: %v", err)
	}

	log.Println("seeds applied successfully")
}
