package audit

import (
	"context"
	"database/sql"
	"fmt"
)

type Service struct {
	db *sql.DB
}

func NewService(db *sql.DB) *Service {
	return &Service{db: db}
}

func (s *Service) ListTenantLogs(ctx context.Context, tenantID string, limit int) ([]Entry, error) {
	if limit <= 0 || limit > 100 {
		limit = 25
	}

	rows, err := s.db.QueryContext(ctx, `
		SELECT id, action, target_type, target_id, created_at
		FROM audit_logs
		WHERE tenant_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`, tenantID, limit)
	if err != nil {
		return nil, fmt.Errorf("query tenant audit logs: %w", err)
	}
	defer rows.Close()

	entries := make([]Entry, 0, limit)
	for rows.Next() {
		var entry Entry
		if err := rows.Scan(
			&entry.ID,
			&entry.Action,
			&entry.TargetType,
			&entry.TargetID,
			&entry.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan tenant audit log: %w", err)
		}
		entries = append(entries, entry)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate tenant audit logs: %w", err)
	}

	return entries, nil
}
