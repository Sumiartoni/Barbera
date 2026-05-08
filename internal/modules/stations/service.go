package stations

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
)

type Service struct {
	db *sql.DB
}

func NewService(db *sql.DB) *Service {
	return &Service{db: db}
}

func (s *Service) List(ctx context.Context, tenantID string) ([]Station, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, tenant_id, name, status, created_at, updated_at
		FROM stations
		WHERE tenant_id = $1
		ORDER BY name ASC
	`, tenantID)
	if err != nil {
		return nil, fmt.Errorf("query stations: %w", err)
	}
	defer rows.Close()

	stations := make([]Station, 0, 8)
	for rows.Next() {
		var record Station
		if err := rows.Scan(
			&record.ID,
			&record.TenantID,
			&record.Name,
			&record.Status,
			&record.CreatedAt,
			&record.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan station: %w", err)
		}
		stations = append(stations, record)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate stations: %w", err)
	}

	return stations, nil
}

func (s *Service) Create(ctx context.Context, tenantID string, input CreateInput) (Station, error) {
	name := strings.TrimSpace(input.Name)
	status := strings.TrimSpace(input.Status)
	if tenantID == "" || name == "" {
		return Station{}, ErrValidation
	}
	if status == "" {
		status = "active"
	}

	var record Station
	err := s.db.QueryRowContext(ctx, `
		INSERT INTO stations (tenant_id, name, status)
		VALUES ($1, $2, $3)
		RETURNING id, tenant_id, name, status, created_at, updated_at
	`, tenantID, name, status).Scan(
		&record.ID,
		&record.TenantID,
		&record.Name,
		&record.Status,
		&record.CreatedAt,
		&record.UpdatedAt,
	)
	if err != nil {
		return Station{}, fmt.Errorf("insert station: %w", err)
	}

	return record, nil
}

func (s *Service) Update(ctx context.Context, tenantID string, stationID string, input UpdateInput) (Station, error) {
	name := strings.TrimSpace(input.Name)
	status := strings.TrimSpace(input.Status)
	if tenantID == "" || stationID == "" || name == "" {
		return Station{}, ErrValidation
	}
	if status == "" {
		status = "active"
	}

	result, err := s.db.ExecContext(ctx, `
		UPDATE stations
		SET name = $3,
			status = $4,
			updated_at = NOW()
		WHERE tenant_id = $1 AND id = $2
	`, tenantID, stationID, name, status)
	if err != nil {
		return Station{}, fmt.Errorf("update station: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return Station{}, fmt.Errorf("station rows affected: %w", err)
	}
	if rowsAffected == 0 {
		return Station{}, fmt.Errorf("station not found")
	}

	var record Station
	err = s.db.QueryRowContext(ctx, `
		SELECT id, tenant_id, name, status, created_at, updated_at
		FROM stations
		WHERE tenant_id = $1 AND id = $2
		LIMIT 1
	`, tenantID, stationID).Scan(
		&record.ID,
		&record.TenantID,
		&record.Name,
		&record.Status,
		&record.CreatedAt,
		&record.UpdatedAt,
	)
	if err != nil {
		return Station{}, fmt.Errorf("load station after update: %w", err)
	}

	return record, nil
}
