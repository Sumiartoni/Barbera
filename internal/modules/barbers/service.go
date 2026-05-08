package barbers

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"
)

type Service struct {
	db *sql.DB
}

func NewService(db *sql.DB) *Service {
	return &Service{db: db}
}

func (s *Service) List(ctx context.Context, tenantID string, options ListOptions) ([]Barber, error) {
	at := options.At
	if at.IsZero() {
		at = time.Now().UTC()
	}

	rows, err := s.db.QueryContext(ctx, `
		SELECT
			b.id,
			b.tenant_id,
			b.full_name,
			b.phone_number,
			b.status,
			b.is_bookable,
			b.sort_order,
			EXISTS (
				SELECT 1
				FROM barber_shifts bs
				WHERE bs.tenant_id = b.tenant_id
				  AND bs.barber_id = b.id
				  AND bs.status = 'scheduled'
				  AND bs.starts_at <= $2
				  AND bs.ends_at > $2
			) AS on_shift,
			(
				SELECT bs.ends_at
				FROM barber_shifts bs
				WHERE bs.tenant_id = b.tenant_id
				  AND bs.barber_id = b.id
				  AND bs.status = 'scheduled'
				  AND bs.starts_at <= $2
				  AND bs.ends_at > $2
				ORDER BY bs.ends_at ASC
				LIMIT 1
			) AS current_shift_end,
			b.created_at,
			b.updated_at
		FROM barbers b
		WHERE b.tenant_id = $1
		ORDER BY b.sort_order ASC, b.full_name ASC
	`, tenantID, at)
	if err != nil {
		return nil, fmt.Errorf("query barbers: %w", err)
	}
	defer rows.Close()

	barbers := make([]Barber, 0, 16)
	for rows.Next() {
		var (
			record          Barber
			currentShiftEnd sql.NullTime
		)
		if err := rows.Scan(
			&record.ID,
			&record.TenantID,
			&record.FullName,
			&record.PhoneNumber,
			&record.Status,
			&record.IsBookable,
			&record.SortOrder,
			&record.OnShift,
			&currentShiftEnd,
			&record.CreatedAt,
			&record.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan barber: %w", err)
		}

		if currentShiftEnd.Valid {
			value := currentShiftEnd.Time.UTC()
			record.CurrentShiftEnd = &value
		}

		barbers = append(barbers, record)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate barbers: %w", err)
	}

	return barbers, nil
}

func (s *Service) Create(ctx context.Context, tenantID string, input CreateInput) (Barber, error) {
	fullName := strings.TrimSpace(input.FullName)
	phoneNumber := strings.TrimSpace(input.PhoneNumber)
	if tenantID == "" || fullName == "" {
		return Barber{}, ErrValidation
	}

	isBookable := true
	if input.IsBookable != nil {
		isBookable = *input.IsBookable
	}
	status := strings.TrimSpace(input.Status)
	if status == "" {
		status = "active"
	}

	record := Barber{}
	err := s.db.QueryRowContext(ctx, `
		INSERT INTO barbers (
			tenant_id,
			full_name,
			phone_number,
			status,
			is_bookable,
			sort_order
		)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING
			id,
			tenant_id,
			full_name,
			phone_number,
			status,
			is_bookable,
			sort_order,
			created_at,
			updated_at
	`, tenantID, fullName, phoneNumber, status, isBookable, input.SortOrder).Scan(
		&record.ID,
		&record.TenantID,
		&record.FullName,
		&record.PhoneNumber,
		&record.Status,
		&record.IsBookable,
		&record.SortOrder,
		&record.CreatedAt,
		&record.UpdatedAt,
	)
	if err != nil {
		return Barber{}, fmt.Errorf("insert barber: %w", err)
	}

	return record, nil
}

func (s *Service) Update(ctx context.Context, tenantID string, barberID string, input UpdateInput) (Barber, error) {
	fullName := strings.TrimSpace(input.FullName)
	phoneNumber := strings.TrimSpace(input.PhoneNumber)
	status := strings.TrimSpace(input.Status)
	if tenantID == "" || barberID == "" || fullName == "" {
		return Barber{}, ErrValidation
	}
	if status == "" {
		status = "active"
	}

	isBookable := true
	if input.IsBookable != nil {
		isBookable = *input.IsBookable
	}

	result, err := s.db.ExecContext(ctx, `
		UPDATE barbers
		SET full_name = $3,
			phone_number = $4,
			sort_order = $5,
			is_bookable = $6,
			status = $7,
			updated_at = NOW()
		WHERE tenant_id = $1 AND id = $2
	`, tenantID, barberID, fullName, phoneNumber, input.SortOrder, isBookable, status)
	if err != nil {
		return Barber{}, fmt.Errorf("update barber: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return Barber{}, fmt.Errorf("barber rows affected: %w", err)
	}
	if rowsAffected == 0 {
		return Barber{}, ErrNotFound
	}

	items, err := s.List(ctx, tenantID, ListOptions{})
	if err != nil {
		return Barber{}, err
	}
	for _, item := range items {
		if item.ID == barberID {
			return item, nil
		}
	}

	return Barber{}, ErrNotFound
}

func (s *Service) FindByName(ctx context.Context, tenantID string, rawName string) (Barber, error) {
	name := strings.TrimSpace(strings.ToLower(rawName))
	if tenantID == "" || name == "" {
		return Barber{}, ErrValidation
	}

	var record Barber
	err := s.db.QueryRowContext(ctx, `
		SELECT
			id,
			tenant_id,
			full_name,
			phone_number,
			status,
			is_bookable,
			sort_order,
			created_at,
			updated_at
		FROM barbers
		WHERE tenant_id = $1
		  AND LOWER(full_name) = $2
		LIMIT 1
	`, tenantID, name).Scan(
		&record.ID,
		&record.TenantID,
		&record.FullName,
		&record.PhoneNumber,
		&record.Status,
		&record.IsBookable,
		&record.SortOrder,
		&record.CreatedAt,
		&record.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Barber{}, ErrNotFound
		}
		return Barber{}, fmt.Errorf("find barber by name: %w", err)
	}

	return record, nil
}
