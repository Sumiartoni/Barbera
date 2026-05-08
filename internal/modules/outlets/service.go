package outlets

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

func (s *Service) List(ctx context.Context, tenantID string) ([]Outlet, Entitlement, error) {
	entitlement, err := s.GetEntitlement(ctx, tenantID)
	if err != nil {
		return nil, Entitlement{}, err
	}

	rows, err := s.db.QueryContext(ctx, `
		SELECT
			id,
			tenant_id,
			name,
			code,
			address,
			phone_number,
			status,
			is_primary,
			created_at,
			updated_at
		FROM outlets
		WHERE tenant_id = $1
		ORDER BY is_primary DESC, created_at ASC
	`, tenantID)
	if err != nil {
		return nil, Entitlement{}, fmt.Errorf("query outlets: %w", err)
	}
	defer rows.Close()

	outlets := make([]Outlet, 0, entitlement.CurrentOutlets)
	for rows.Next() {
		var outlet Outlet
		if err := rows.Scan(
			&outlet.ID,
			&outlet.TenantID,
			&outlet.Name,
			&outlet.Code,
			&outlet.Address,
			&outlet.PhoneNumber,
			&outlet.Status,
			&outlet.IsPrimary,
			&outlet.CreatedAt,
			&outlet.UpdatedAt,
		); err != nil {
			return nil, Entitlement{}, fmt.Errorf("scan outlet: %w", err)
		}
		outlets = append(outlets, outlet)
	}

	if err := rows.Err(); err != nil {
		return nil, Entitlement{}, fmt.Errorf("iterate outlets: %w", err)
	}

	return outlets, entitlement, nil
}

func (s *Service) Create(ctx context.Context, tenantID string, input CreateInput) (Outlet, Entitlement, error) {
	name := strings.TrimSpace(input.Name)
	code := strings.TrimSpace(strings.ToUpper(input.Code))
	address := strings.TrimSpace(input.Address)
	phoneNumber := strings.TrimSpace(input.PhoneNumber)
	status := strings.TrimSpace(input.Status)
	if tenantID == "" || name == "" {
		return Outlet{}, Entitlement{}, ErrValidation
	}
	if status == "" {
		status = "active"
	}

	entitlement, err := s.GetEntitlement(ctx, tenantID)
	if err != nil {
		return Outlet{}, Entitlement{}, err
	}
	if !entitlement.CanCreateMore {
		return Outlet{}, entitlement, ErrPlanLimitExceeded
	}

	record := Outlet{}
	err = s.db.QueryRowContext(ctx, `
		INSERT INTO outlets (
			tenant_id,
			name,
			code,
			address,
			phone_number,
			status,
			is_primary
		)
		VALUES (
			$1,
			$2,
			$3,
			$4,
			$5,
			$6,
			CASE
				WHEN EXISTS (
					SELECT 1 FROM outlets WHERE tenant_id = $1 AND is_primary = TRUE
				) THEN FALSE
				ELSE TRUE
			END
		)
		RETURNING
			id,
			tenant_id,
			name,
			code,
			address,
			phone_number,
			status,
			is_primary,
			created_at,
			updated_at
	`, tenantID, name, code, address, phoneNumber, status).Scan(
		&record.ID,
		&record.TenantID,
		&record.Name,
		&record.Code,
		&record.Address,
		&record.PhoneNumber,
		&record.Status,
		&record.IsPrimary,
		&record.CreatedAt,
		&record.UpdatedAt,
	)
	if err != nil {
		return Outlet{}, Entitlement{}, fmt.Errorf("insert outlet: %w", err)
	}

	entitlement.CurrentOutlets++
	entitlement.CanCreateMore = entitlement.CurrentOutlets < entitlement.MaxOutlets

	return record, entitlement, nil
}

func (s *Service) CreateInitial(ctx context.Context, tx *sql.Tx, tenantID string, tenantName string) error {
	if tenantID == "" {
		return ErrValidation
	}

	name := "Outlet Utama"
	if trimmed := strings.TrimSpace(tenantName); trimmed != "" {
		name = fmt.Sprintf("%s - Outlet Utama", trimmed)
	}

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO outlets (tenant_id, name, code, is_primary)
		VALUES ($1, $2, 'HQ', TRUE)
	`, tenantID, name); err != nil {
		return fmt.Errorf("insert initial outlet: %w", err)
	}

	return nil
}

func (s *Service) Update(ctx context.Context, tenantID string, outletID string, input UpdateInput) (Outlet, error) {
	name := strings.TrimSpace(input.Name)
	code := strings.TrimSpace(strings.ToUpper(input.Code))
	address := strings.TrimSpace(input.Address)
	phoneNumber := strings.TrimSpace(input.PhoneNumber)
	status := strings.TrimSpace(input.Status)
	if tenantID == "" || outletID == "" || name == "" {
		return Outlet{}, ErrValidation
	}
	if status == "" {
		status = "active"
	}

	result, err := s.db.ExecContext(ctx, `
		UPDATE outlets
		SET name = $3,
			code = $4,
			address = $5,
			phone_number = $6,
			status = $7,
			updated_at = NOW()
		WHERE tenant_id = $1 AND id = $2
	`, tenantID, outletID, name, code, address, phoneNumber, status)
	if err != nil {
		return Outlet{}, fmt.Errorf("update outlet: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return Outlet{}, fmt.Errorf("outlet rows affected: %w", err)
	}
	if rowsAffected == 0 {
		return Outlet{}, fmt.Errorf("outlet not found")
	}

	var record Outlet
	err = s.db.QueryRowContext(ctx, `
		SELECT
			id,
			tenant_id,
			name,
			code,
			address,
			phone_number,
			status,
			is_primary,
			created_at,
			updated_at
		FROM outlets
		WHERE tenant_id = $1 AND id = $2
		LIMIT 1
	`, tenantID, outletID).Scan(
		&record.ID,
		&record.TenantID,
		&record.Name,
		&record.Code,
		&record.Address,
		&record.PhoneNumber,
		&record.Status,
		&record.IsPrimary,
		&record.CreatedAt,
		&record.UpdatedAt,
	)
	if err != nil {
		return Outlet{}, fmt.Errorf("load outlet after update: %w", err)
	}

	return record, nil
}

func (s *Service) GetEntitlement(ctx context.Context, tenantID string) (Entitlement, error) {
	if tenantID == "" {
		return Entitlement{}, ErrValidation
	}

	entitlement := Entitlement{}
	err := s.db.QueryRowContext(ctx, `
		SELECT
			COALESCE(p.code, 'free') AS plan_code,
			COALESCE(pl.max_outlets, 1) AS max_outlets,
			COALESCE(pl.allow_multi_outlet, FALSE) AS allow_multi_outlet,
			(
				SELECT COUNT(*)
				FROM outlets
				WHERE tenant_id = $1
			)::int AS current_outlets
		FROM tenants t
		LEFT JOIN LATERAL (
			SELECT plan_id
			FROM tenant_subscriptions
			WHERE tenant_id = t.id
			  AND status IN ('active', 'trial', 'grace')
			ORDER BY created_at DESC
			LIMIT 1
		) ts ON TRUE
		LEFT JOIN plans p ON p.id = ts.plan_id
		LEFT JOIN plan_limits pl ON pl.plan_id = p.id
		WHERE t.id = $1
		LIMIT 1
	`, tenantID).Scan(
		&entitlement.PlanCode,
		&entitlement.MaxOutlets,
		&entitlement.AllowMultiOutlet,
		&entitlement.CurrentOutlets,
	)
	if err != nil {
		return Entitlement{}, fmt.Errorf("load outlet entitlement: %w", err)
	}

	entitlement.CanCreateMore = entitlement.CurrentOutlets < entitlement.MaxOutlets
	return entitlement, nil
}
