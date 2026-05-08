package teammembers

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"golang.org/x/crypto/bcrypt"
)

type Service struct {
	db *sql.DB
}

func NewService(db *sql.DB) *Service {
	return &Service{db: db}
}

func (s *Service) List(ctx context.Context, tenantID string) ([]Member, error) {
	if strings.TrimSpace(tenantID) == "" {
		return nil, ErrValidation
	}

	rows, err := s.db.QueryContext(ctx, `
		SELECT
			tm.id,
			u.id,
			u.email,
			u.full_name,
			u.phone_number,
			tm.role,
			u.status,
			tm.is_primary,
			u.last_login_at,
			tm.created_at,
			tm.updated_at
		FROM tenant_memberships tm
		INNER JOIN users u ON u.id = tm.user_id
		WHERE tm.tenant_id = $1
		ORDER BY tm.is_primary DESC, tm.created_at ASC, u.full_name ASC
	`, tenantID)
	if err != nil {
		return nil, fmt.Errorf("query team members: %w", err)
	}
	defer rows.Close()

	members := make([]Member, 0, 8)
	for rows.Next() {
		var (
			record      Member
			lastLoginAt sql.NullTime
		)
		if err := rows.Scan(
			&record.MembershipID,
			&record.UserID,
			&record.Email,
			&record.FullName,
			&record.PhoneNumber,
			&record.Role,
			&record.Status,
			&record.IsPrimary,
			&lastLoginAt,
			&record.CreatedAt,
			&record.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan team member: %w", err)
		}
		if lastLoginAt.Valid {
			value := lastLoginAt.Time.UTC()
			record.LastLoginAt = &value
		}
		members = append(members, record)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate team members: %w", err)
	}

	return members, nil
}

func (s *Service) Create(ctx context.Context, tenantID string, input CreateInput) (Member, error) {
	email := normalizeEmail(input.Email)
	fullName := strings.TrimSpace(input.FullName)
	phoneNumber := strings.TrimSpace(input.PhoneNumber)
	role := normalizeRole(input.Role)
	if strings.TrimSpace(tenantID) == "" || email == "" || fullName == "" || len(strings.TrimSpace(input.Password)) < 8 {
		return Member{}, ErrValidation
	}
	if role != "admin" && role != "cashier" {
		return Member{}, ErrValidation
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return Member{}, fmt.Errorf("begin create team member tx: %w", err)
	}
	defer tx.Rollback()

	var exists string
	if err := tx.QueryRowContext(ctx, `SELECT email FROM users WHERE email = $1`, email).Scan(&exists); err == nil {
		return Member{}, ErrEmailUsed
	} else if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return Member{}, fmt.Errorf("check team member email: %w", err)
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(strings.TrimSpace(input.Password)), bcrypt.DefaultCost)
	if err != nil {
		return Member{}, fmt.Errorf("hash team member password: %w", err)
	}

	var userID string
	if err := tx.QueryRowContext(ctx, `
		INSERT INTO users (email, full_name, phone_number, password_hash, status)
		VALUES ($1, $2, $3, $4, 'active')
		RETURNING id
	`, email, fullName, phoneNumber, string(passwordHash)).Scan(&userID); err != nil {
		return Member{}, fmt.Errorf("insert team member user: %w", err)
	}

	var membershipID string
	if err := tx.QueryRowContext(ctx, `
		INSERT INTO tenant_memberships (tenant_id, user_id, role, is_primary)
		VALUES ($1, $2, $3, FALSE)
		RETURNING id
	`, tenantID, userID, role).Scan(&membershipID); err != nil {
		return Member{}, fmt.Errorf("insert team membership: %w", err)
	}

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO audit_logs (tenant_id, actor_user_id, action, target_type, target_id, metadata)
		VALUES ($1, NULL, 'team_member.created', 'tenant_membership', $2, jsonb_build_object('role', $3::text, 'email', $4::text))
	`, tenantID, membershipID, role, email); err != nil {
		return Member{}, fmt.Errorf("insert team member audit log: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return Member{}, fmt.Errorf("commit create team member tx: %w", err)
	}

	return s.GetByMembershipID(ctx, tenantID, membershipID)
}

func (s *Service) Update(ctx context.Context, tenantID string, membershipID string, input UpdateInput) (Member, error) {
	membershipID = strings.TrimSpace(membershipID)
	fullName := strings.TrimSpace(input.FullName)
	phoneNumber := strings.TrimSpace(input.PhoneNumber)
	role := normalizeRole(input.Role)
	status := strings.TrimSpace(strings.ToLower(input.Status))
	password := strings.TrimSpace(input.Password)
	if strings.TrimSpace(tenantID) == "" || membershipID == "" || fullName == "" {
		return Member{}, ErrValidation
	}
	if role != "owner" && role != "admin" && role != "cashier" {
		return Member{}, ErrValidation
	}
	if status == "" {
		status = "active"
	}
	if status != "active" && status != "disabled" && status != "pending" {
		return Member{}, ErrValidation
	}
	if password != "" && len(password) < 8 {
		return Member{}, ErrValidation
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return Member{}, fmt.Errorf("begin update team member tx: %w", err)
	}
	defer tx.Rollback()

	var (
		userID    string
		isPrimary bool
	)
	if err := tx.QueryRowContext(ctx, `
		SELECT user_id, is_primary
		FROM tenant_memberships
		WHERE tenant_id = $1
		  AND id = $2
		LIMIT 1
	`, tenantID, membershipID).Scan(&userID, &isPrimary); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Member{}, ErrMemberNotFound
		}
		return Member{}, fmt.Errorf("load team membership for update: %w", err)
	}
	if isPrimary && (role != "owner" || status != "active") {
		return Member{}, ErrPrimaryOwner
	}

	passwordHash := ""
	if password != "" {
		generated, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			return Member{}, fmt.Errorf("hash updated team password: %w", err)
		}
		passwordHash = string(generated)
	}

	if _, err := tx.ExecContext(ctx, `
		UPDATE users
		SET full_name = $2,
			phone_number = $3,
			status = $4,
			password_hash = CASE WHEN $5 <> '' THEN $5 ELSE password_hash END,
			updated_at = NOW()
		WHERE id = $1
	`, userID, fullName, phoneNumber, status, passwordHash); err != nil {
		return Member{}, fmt.Errorf("update team member user: %w", err)
	}

	if _, err := tx.ExecContext(ctx, `
		UPDATE tenant_memberships
		SET role = $3,
			updated_at = NOW()
		WHERE tenant_id = $1
		  AND id = $2
	`, tenantID, membershipID, role); err != nil {
		return Member{}, fmt.Errorf("update tenant membership role: %w", err)
	}

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO audit_logs (tenant_id, actor_user_id, action, target_type, target_id, metadata)
		VALUES ($1, NULL, 'team_member.updated', 'tenant_membership', $2, jsonb_build_object('role', $3::text, 'status', $4::text, 'password_reset', $5::boolean))
	`, tenantID, membershipID, role, status, password != ""); err != nil {
		return Member{}, fmt.Errorf("insert team member update audit log: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return Member{}, fmt.Errorf("commit update team member tx: %w", err)
	}

	return s.GetByMembershipID(ctx, tenantID, membershipID)
}

func (s *Service) GetByMembershipID(ctx context.Context, tenantID string, membershipID string) (Member, error) {
	if strings.TrimSpace(tenantID) == "" || strings.TrimSpace(membershipID) == "" {
		return Member{}, ErrValidation
	}

	var (
		record      Member
		lastLoginAt sql.NullTime
	)
	if err := s.db.QueryRowContext(ctx, `
		SELECT
			tm.id,
			u.id,
			u.email,
			u.full_name,
			u.phone_number,
			tm.role,
			u.status,
			tm.is_primary,
			u.last_login_at,
			tm.created_at,
			tm.updated_at
		FROM tenant_memberships tm
		INNER JOIN users u ON u.id = tm.user_id
		WHERE tm.tenant_id = $1
		  AND tm.id = $2
		LIMIT 1
	`, tenantID, membershipID).Scan(
		&record.MembershipID,
		&record.UserID,
		&record.Email,
		&record.FullName,
		&record.PhoneNumber,
		&record.Role,
		&record.Status,
		&record.IsPrimary,
		&lastLoginAt,
		&record.CreatedAt,
		&record.UpdatedAt,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Member{}, ErrMemberNotFound
		}
		return Member{}, fmt.Errorf("load team member: %w", err)
	}
	if lastLoginAt.Valid {
		value := lastLoginAt.Time.UTC()
		record.LastLoginAt = &value
	}

	return record, nil
}

func normalizeEmail(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func normalizeRole(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}
