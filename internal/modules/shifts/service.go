package shifts

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

func (s *Service) List(ctx context.Context, tenantID string, day time.Time) ([]Shift, error) {
	start := day
	if start.IsZero() {
		now := time.Now().UTC()
		start = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	} else {
		start = time.Date(start.Year(), start.Month(), start.Day(), 0, 0, 0, 0, start.Location())
	}
	end := start.Add(24 * time.Hour)

	rows, err := s.db.QueryContext(ctx, `
		SELECT
			bs.id,
			bs.tenant_id,
			bs.barber_id,
			b.full_name,
			bs.starts_at,
			bs.ends_at,
			bs.source,
			bs.status,
			bs.notes,
			COALESCE(bs.created_by_user_id::text, ''),
			bs.created_at
		FROM barber_shifts bs
		INNER JOIN barbers b ON b.id = bs.barber_id
		WHERE bs.tenant_id = $1
		  AND bs.starts_at < $3
		  AND bs.ends_at > $2
		ORDER BY bs.starts_at ASC, b.full_name ASC
	`, tenantID, start, end)
	if err != nil {
		return nil, fmt.Errorf("query shifts: %w", err)
	}
	defer rows.Close()

	shifts := make([]Shift, 0, 16)
	for rows.Next() {
		var record Shift
		if err := rows.Scan(
			&record.ID,
			&record.TenantID,
			&record.BarberID,
			&record.BarberName,
			&record.StartsAt,
			&record.EndsAt,
			&record.Source,
			&record.Status,
			&record.Notes,
			&record.CreatedByUserID,
			&record.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan shift: %w", err)
		}
		shifts = append(shifts, record)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate shifts: %w", err)
	}

	return shifts, nil
}

func (s *Service) Create(ctx context.Context, tenantID string, input CreateInput) (Shift, error) {
	if tenantID == "" || input.BarberID == "" || input.StartsAt.IsZero() || input.EndsAt.IsZero() || !input.EndsAt.After(input.StartsAt) {
		return Shift{}, ErrValidation
	}

	source := strings.TrimSpace(input.Source)
	if source == "" {
		source = "dashboard"
	}
	status := strings.TrimSpace(strings.ToLower(input.Status))
	if status == "" {
		status = "scheduled"
	}
	if status != "scheduled" && status != "canceled" {
		return Shift{}, ErrValidation
	}

	var barberName string
	err := s.db.QueryRowContext(ctx, `
		SELECT full_name
		FROM barbers
		WHERE tenant_id = $1 AND id = $2 AND status = 'active'
		LIMIT 1
	`, tenantID, input.BarberID).Scan(&barberName)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Shift{}, ErrBarberMiss
		}
		return Shift{}, fmt.Errorf("load barber for shift: %w", err)
	}

	var overlaps bool
	err = s.db.QueryRowContext(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM barber_shifts
			WHERE tenant_id = $1
			  AND barber_id = $2
			  AND status = 'scheduled'
			  AND starts_at < $4
			  AND ends_at > $3
		)
	`, tenantID, input.BarberID, input.StartsAt.UTC(), input.EndsAt.UTC()).Scan(&overlaps)
	if err != nil {
		return Shift{}, fmt.Errorf("check shift overlap: %w", err)
	}
	if overlaps {
		return Shift{}, ErrOverlapShift
	}

	record := Shift{}
	err = s.db.QueryRowContext(ctx, `
		INSERT INTO barber_shifts (
			tenant_id,
			barber_id,
			starts_at,
			ends_at,
			source,
			status,
			notes,
			created_by_user_id
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, NULLIF($8, '')::uuid)
		RETURNING
			id,
			tenant_id,
			barber_id,
			starts_at,
			ends_at,
			source,
			status,
			notes,
			COALESCE(created_by_user_id::text, ''),
			created_at
	`, tenantID, input.BarberID, input.StartsAt.UTC(), input.EndsAt.UTC(), source, status, strings.TrimSpace(input.Notes), input.CreatedByUserID).Scan(
		&record.ID,
		&record.TenantID,
		&record.BarberID,
		&record.StartsAt,
		&record.EndsAt,
		&record.Source,
		&record.Status,
		&record.Notes,
		&record.CreatedByUserID,
		&record.CreatedAt,
	)
	if err != nil {
		return Shift{}, fmt.Errorf("insert shift: %w", err)
	}

	record.BarberName = barberName
	return record, nil
}

func (s *Service) Update(ctx context.Context, tenantID string, shiftID string, input UpdateInput) (Shift, error) {
	if tenantID == "" || strings.TrimSpace(shiftID) == "" || input.BarberID == "" || input.StartsAt.IsZero() || input.EndsAt.IsZero() || !input.EndsAt.After(input.StartsAt) {
		return Shift{}, ErrValidation
	}

	status := strings.TrimSpace(strings.ToLower(input.Status))
	if status == "" {
		status = "scheduled"
	}
	if status != "scheduled" && status != "canceled" {
		return Shift{}, ErrValidation
	}

	var existingID string
	if err := s.db.QueryRowContext(ctx, `
		SELECT id
		FROM barber_shifts
		WHERE tenant_id = $1 AND id = $2
		LIMIT 1
	`, tenantID, shiftID).Scan(&existingID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Shift{}, ErrShiftMissing
		}
		return Shift{}, fmt.Errorf("load shift for update: %w", err)
	}

	barberName, err := s.loadBarberName(ctx, tenantID, input.BarberID)
	if err != nil {
		return Shift{}, err
	}

	overlaps, err := s.hasOverlap(ctx, tenantID, input.BarberID, input.StartsAt.UTC(), input.EndsAt.UTC(), shiftID)
	if err != nil {
		return Shift{}, err
	}
	if overlaps {
		return Shift{}, ErrOverlapShift
	}

	record := Shift{}
	err = s.db.QueryRowContext(ctx, `
		UPDATE barber_shifts
		SET barber_id = $3,
			starts_at = $4,
			ends_at = $5,
			notes = $6,
			status = $7,
			updated_at = NOW()
		WHERE tenant_id = $1
		  AND id = $2
		RETURNING
			id,
			tenant_id,
			barber_id,
			starts_at,
			ends_at,
			source,
			status,
			notes,
			COALESCE(created_by_user_id::text, ''),
			created_at
	`, tenantID, shiftID, input.BarberID, input.StartsAt.UTC(), input.EndsAt.UTC(), strings.TrimSpace(input.Notes), status).Scan(
		&record.ID,
		&record.TenantID,
		&record.BarberID,
		&record.StartsAt,
		&record.EndsAt,
		&record.Source,
		&record.Status,
		&record.Notes,
		&record.CreatedByUserID,
		&record.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Shift{}, ErrShiftMissing
		}
		return Shift{}, fmt.Errorf("update shift: %w", err)
	}

	record.BarberName = barberName
	return record, nil
}

func (s *Service) CancelByBarberAndDay(ctx context.Context, tenantID string, barberID string, day time.Time) (int64, error) {
	if tenantID == "" || barberID == "" || day.IsZero() {
		return 0, ErrValidation
	}

	start := time.Date(day.Year(), day.Month(), day.Day(), 0, 0, 0, 0, day.Location())
	end := start.Add(24 * time.Hour)

	result, err := s.db.ExecContext(ctx, `
		UPDATE barber_shifts
		SET status = 'canceled', updated_at = NOW()
		WHERE tenant_id = $1
		  AND barber_id = $2
		  AND status = 'scheduled'
		  AND starts_at < $4
		  AND ends_at > $3
	`, tenantID, barberID, start, end)
	if err != nil {
		return 0, fmt.Errorf("cancel shifts: %w", err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("shift rows affected: %w", err)
	}

	return affected, nil
}

func (s *Service) loadBarberName(ctx context.Context, tenantID string, barberID string) (string, error) {
	var barberName string
	err := s.db.QueryRowContext(ctx, `
		SELECT full_name
		FROM barbers
		WHERE tenant_id = $1 AND id = $2 AND status = 'active'
		LIMIT 1
	`, tenantID, barberID).Scan(&barberName)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", ErrBarberMiss
		}
		return "", fmt.Errorf("load barber for shift: %w", err)
	}

	return barberName, nil
}

func (s *Service) hasOverlap(ctx context.Context, tenantID string, barberID string, startsAt time.Time, endsAt time.Time, excludeShiftID string) (bool, error) {
	var overlaps bool
	err := s.db.QueryRowContext(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM barber_shifts
			WHERE tenant_id = $1
			  AND barber_id = $2
			  AND status = 'scheduled'
			  AND id <> COALESCE(NULLIF($5, '')::uuid, id)
			  AND starts_at < $4
			  AND ends_at > $3
		)
	`, tenantID, barberID, startsAt, endsAt, strings.TrimSpace(excludeShiftID)).Scan(&overlaps)
	if err != nil {
		return false, fmt.Errorf("check shift overlap: %w", err)
	}

	return overlaps, nil
}
