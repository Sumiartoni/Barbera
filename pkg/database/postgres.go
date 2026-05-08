package database

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"balikcukur/pkg/config"

	_ "github.com/jackc/pgx/v5/stdlib"
)

func Connect(cfg config.PostgresConfig) (*sql.DB, error) {
	if cfg.DSN == "" {
		return nil, errors.New("postgres dsn is required")
	}

	db, err := sql.Open("pgx", cfg.DSN)
	if err != nil {
		return nil, err
	}

	db.SetMaxOpenConns(15)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(30 * time.Minute)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()
		return nil, err
	}

	return db, nil
}
