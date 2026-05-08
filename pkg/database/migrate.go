package database

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

func ApplyMigrations(ctx context.Context, db *sql.DB, dir string) error {
	if _, err := db.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			file_name TEXT PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`); err != nil {
		return fmt.Errorf("ensure schema_migrations table: %w", err)
	}

	return applySQLFiles(ctx, db, dir, true)
}

func ApplySeeds(ctx context.Context, db *sql.DB, dir string) error {
	return applySQLFiles(ctx, db, dir, false)
}

func applySQLFiles(ctx context.Context, db *sql.DB, dir string, track bool) error {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return fmt.Errorf("read dir %s: %w", dir, err)
	}

	files := make([]string, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".sql") {
			continue
		}
		files = append(files, entry.Name())
	}

	sort.Strings(files)

	for _, fileName := range files {
		if track {
			applied, err := migrationApplied(ctx, db, fileName)
			if err != nil {
				return err
			}
			if applied {
				continue
			}
		}

		path := filepath.Join(dir, fileName)
		rawSQL, err := os.ReadFile(path)
		if err != nil {
			return fmt.Errorf("read %s: %w", path, err)
		}

		tx, err := db.BeginTx(ctx, nil)
		if err != nil {
			return fmt.Errorf("begin tx for %s: %w", fileName, err)
		}

		if _, err := tx.ExecContext(ctx, string(rawSQL)); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("exec %s: %w", fileName, err)
		}

		if track {
			if _, err := tx.ExecContext(ctx, `
				INSERT INTO schema_migrations (file_name) VALUES ($1)
				ON CONFLICT (file_name) DO NOTHING
			`, fileName); err != nil {
				_ = tx.Rollback()
				return fmt.Errorf("track %s: %w", fileName, err)
			}
		}

		if err := tx.Commit(); err != nil {
			return fmt.Errorf("commit %s: %w", fileName, err)
		}
	}

	return nil
}

func migrationApplied(ctx context.Context, db *sql.DB, fileName string) (bool, error) {
	var exists bool
	err := db.QueryRowContext(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM schema_migrations
			WHERE file_name = $1
		)
	`, fileName).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("check migration %s: %w", fileName, err)
	}

	return exists, nil
}
