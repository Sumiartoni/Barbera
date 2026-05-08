package staffaccess

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"balikcukur/internal/modules/auth"
	"golang.org/x/crypto/bcrypt"
)

type Service struct {
	db          *sql.DB
	tokenIssuer tokenIssuer
	publicURL   string
}

type tokenIssuer interface {
	IssueForActor(subjectID string, tenantID string, role string, actorType string) (string, time.Time, error)
}

func NewService(db *sql.DB, tokenIssuer tokenIssuer, publicURL string) *Service {
	return &Service{
		db:          db,
		tokenIssuer: tokenIssuer,
		publicURL:   strings.TrimRight(strings.TrimSpace(publicURL), "/"),
	}
}

func (s *Service) List(ctx context.Context, tenantID string) ([]Account, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT
			ac.id,
			ac.tenant_id,
			ac.barber_id,
			b.full_name,
			ac.role,
			ac.access_code,
			ac.status,
			ac.last_login_at,
			ac.created_at,
			ac.updated_at
		FROM barber_access_credentials ac
		INNER JOIN barbers b ON b.id = ac.barber_id
		WHERE ac.tenant_id = $1
		ORDER BY b.sort_order ASC, b.full_name ASC
	`, tenantID)
	if err != nil {
		return nil, fmt.Errorf("query barber access list: %w", err)
	}
	defer rows.Close()

	accounts := make([]Account, 0, 16)
	for rows.Next() {
		var (
			record      Account
			lastLoginAt sql.NullTime
		)
		if err := rows.Scan(
			&record.ID,
			&record.TenantID,
			&record.BarberID,
			&record.BarberName,
			&record.Role,
			&record.AccessCode,
			&record.Status,
			&lastLoginAt,
			&record.CreatedAt,
			&record.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan barber access account: %w", err)
		}

		if lastLoginAt.Valid {
			value := lastLoginAt.Time.UTC()
			record.LastLoginAt = &value
		}

		accounts = append(accounts, record)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate barber access accounts: %w", err)
	}

	return accounts, nil
}

func (s *Service) Provision(ctx context.Context, tenantID string, input ProvisionInput) (Account, error) {
	barberID := strings.TrimSpace(input.BarberID)
	pin := strings.TrimSpace(input.PIN)
	if tenantID == "" || barberID == "" || len(pin) < 4 {
		return Account{}, ErrValidation
	}

	var barberName string
	if err := s.db.QueryRowContext(ctx, `
		SELECT full_name
		FROM barbers
		WHERE tenant_id = $1 AND id = $2 AND status = 'active'
		LIMIT 1
	`, tenantID, barberID).Scan(&barberName); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Account{}, ErrBarberNotFound
		}
		return Account{}, fmt.Errorf("load barber for access provisioning: %w", err)
	}

	pinHash, err := bcrypt.GenerateFromPassword([]byte(pin), bcrypt.DefaultCost)
	if err != nil {
		return Account{}, fmt.Errorf("hash barber pin: %w", err)
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return Account{}, fmt.Errorf("begin provision tx: %w", err)
	}
	defer tx.Rollback()

	var existingCode string
	err = tx.QueryRowContext(ctx, `
		SELECT access_code
		FROM barber_access_credentials
		WHERE tenant_id = $1 AND barber_id = $2
		LIMIT 1
	`, tenantID, barberID).Scan(&existingCode)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return Account{}, fmt.Errorf("load existing barber access code: %w", err)
	}

	accessCode := existingCode
	if accessCode == "" || input.RegenerateCode {
		accessCode, err = s.generateUniqueAccessCode(ctx, tx)
		if err != nil {
			return Account{}, fmt.Errorf("generate access code: %w", err)
		}
	}

	record := Account{}
	err = tx.QueryRowContext(ctx, `
		INSERT INTO barber_access_credentials (
			tenant_id,
			barber_id,
			role,
			access_code,
			pin_hash,
			status
		)
		VALUES ($1, $2, 'barber', $3, $4, 'active')
		ON CONFLICT (barber_id)
		DO UPDATE SET
			access_code = EXCLUDED.access_code,
			pin_hash = EXCLUDED.pin_hash,
			status = 'active',
			updated_at = NOW()
		RETURNING
			id,
			tenant_id,
			barber_id,
			role,
			access_code,
			status,
			last_login_at,
			created_at,
			updated_at
	`, tenantID, barberID, accessCode, string(pinHash)).Scan(
		&record.ID,
		&record.TenantID,
		&record.BarberID,
		&record.Role,
		&record.AccessCode,
		&record.Status,
		&sqlNullTime{target: &record.LastLoginAt},
		&record.CreatedAt,
		&record.UpdatedAt,
	)
	if err != nil {
		return Account{}, fmt.Errorf("upsert barber access credential: %w", err)
	}

	record.BarberName = barberName

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO audit_logs (tenant_id, actor_user_id, action, target_type, target_id, metadata)
		VALUES (
			$1,
			NULL,
			'barber_access.provisioned',
			'barber',
			$2,
			jsonb_build_object('access_code', $3::text)
		)
	`, tenantID, barberID, accessCode); err != nil {
		return Account{}, fmt.Errorf("insert barber access audit log: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return Account{}, fmt.Errorf("commit barber access provision: %w", err)
	}

	return record, nil
}

func (s *Service) Update(ctx context.Context, tenantID string, accountID string, input UpdateInput) (Account, error) {
	accountID = strings.TrimSpace(accountID)
	pin := strings.TrimSpace(input.PIN)
	status := strings.TrimSpace(strings.ToLower(input.Status))
	if tenantID == "" || accountID == "" {
		return Account{}, ErrValidation
	}
	if status == "" {
		status = "active"
	}
	if status != "active" && status != "disabled" {
		return Account{}, ErrValidation
	}
	if pin != "" && len(pin) < 4 {
		return Account{}, ErrValidation
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return Account{}, fmt.Errorf("begin barber access update tx: %w", err)
	}
	defer tx.Rollback()

	var (
		barberID   string
		barberName string
		accessCode string
	)
	if err := tx.QueryRowContext(ctx, `
		SELECT ac.barber_id, b.full_name, ac.access_code
		FROM barber_access_credentials ac
		INNER JOIN barbers b ON b.id = ac.barber_id
		WHERE ac.tenant_id = $1
		  AND ac.id = $2
		LIMIT 1
	`, tenantID, accountID).Scan(&barberID, &barberName, &accessCode); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Account{}, ErrCredentialInvalid
		}
		return Account{}, fmt.Errorf("load barber access for update: %w", err)
	}

	if input.RegenerateCode {
		accessCode, err = s.generateUniqueAccessCode(ctx, tx)
		if err != nil {
			return Account{}, fmt.Errorf("generate replacement access code: %w", err)
		}
	}

	var pinHash any = nil
	if pin != "" {
		generated, err := bcrypt.GenerateFromPassword([]byte(pin), bcrypt.DefaultCost)
		if err != nil {
			return Account{}, fmt.Errorf("hash updated barber pin: %w", err)
		}
		pinHash = string(generated)
	}

	record := Account{}
	if err := tx.QueryRowContext(ctx, `
		UPDATE barber_access_credentials
		SET access_code = $3,
			pin_hash = COALESCE($4, pin_hash),
			status = $5,
			updated_at = NOW()
		WHERE tenant_id = $1
		  AND id = $2
		RETURNING
			id,
			tenant_id,
			barber_id,
			role,
			access_code,
			status,
			last_login_at,
			created_at,
			updated_at
	`, tenantID, accountID, accessCode, pinHash, status).Scan(
		&record.ID,
		&record.TenantID,
		&record.BarberID,
		&record.Role,
		&record.AccessCode,
		&record.Status,
		&sqlNullTime{target: &record.LastLoginAt},
		&record.CreatedAt,
		&record.UpdatedAt,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Account{}, ErrCredentialInvalid
		}
		return Account{}, fmt.Errorf("update barber access credential: %w", err)
	}
	record.BarberName = barberName

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO audit_logs (tenant_id, actor_user_id, action, target_type, target_id, metadata)
		VALUES (
			$1,
			NULL,
			'barber_access.updated',
			'barber_access_credential',
			$2,
			jsonb_build_object(
				'status', $3::text,
				'regenerated_code', $4::boolean,
				'pin_reset', $5::boolean
			)
		)
	`, tenantID, accountID, status, input.RegenerateCode, pin != ""); err != nil {
		return Account{}, fmt.Errorf("insert barber access update audit log: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return Account{}, fmt.Errorf("commit barber access update tx: %w", err)
	}

	return record, nil
}

func (s *Service) Login(ctx context.Context, input LoginInput) (Session, error) {
	accessCode := strings.ToUpper(strings.TrimSpace(input.AccessCode))
	pin := strings.TrimSpace(input.PIN)
	if accessCode == "" || pin == "" {
		return Session{}, ErrValidation
	}

	var (
		accountID     string
		barberID      string
		barberName    string
		role          string
		status        string
		pinHash       string
		tenantID      string
		tenantSlug    string
		tenantName    string
		publicQueueID string
	)
	err := s.db.QueryRowContext(ctx, `
		SELECT
			ac.id,
			ac.barber_id,
			b.full_name,
			ac.role,
			ac.status,
			ac.pin_hash,
			t.id,
			t.slug,
			t.name,
			t.public_queue_id
		FROM barber_access_credentials ac
		INNER JOIN barbers b ON b.id = ac.barber_id
		INNER JOIN tenants t ON t.id = ac.tenant_id
		WHERE UPPER(ac.access_code) = $1
		  AND t.status = 'active'
		  AND b.status = 'active'
		LIMIT 1
	`, accessCode).Scan(
		&accountID,
		&barberID,
		&barberName,
		&role,
		&status,
		&pinHash,
		&tenantID,
		&tenantSlug,
		&tenantName,
		&publicQueueID,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Session{}, ErrCredentialInvalid
		}
		return Session{}, fmt.Errorf("load barber access credential: %w", err)
	}

	if status != "active" {
		return Session{}, ErrAccessDisabled
	}

	if err := bcrypt.CompareHashAndPassword([]byte(pinHash), []byte(pin)); err != nil {
		return Session{}, ErrCredentialInvalid
	}

	if _, err := s.db.ExecContext(ctx, `
		UPDATE barber_access_credentials
		SET last_login_at = NOW(), updated_at = NOW()
		WHERE id = $1
	`, accountID); err != nil {
		return Session{}, fmt.Errorf("update barber access last_login_at: %w", err)
	}

	token, expiresAt, err := s.tokenIssuer.IssueForActor(accountID, tenantID, role, "staff")
	if err != nil {
		return Session{}, fmt.Errorf("issue staff token: %w", err)
	}

	return Session{
		AccessToken: token,
		TokenType:   "Bearer",
		ExpiresAt:   expiresAt,
		Staff: StaffSummary{
			ID:         accountID,
			BarberID:   barberID,
			FullName:   barberName,
			Role:       role,
			AccessCode: accessCode,
		},
		Tenant: TenantInfo{
			ID:             tenantID,
			Slug:           tenantSlug,
			Name:           tenantName,
			PublicQueueID:  publicQueueID,
			PublicQueueURL: s.publicQueueURL(publicQueueID),
		},
	}, nil
}

func (s *Service) Profile(ctx context.Context, claims auth.AuthClaims) (Session, error) {
	if claims.ActorType != "staff" || claims.UserID == "" || claims.TenantID == "" {
		return Session{}, ErrCredentialInvalid
	}

	var (
		barberID      string
		barberName    string
		role          string
		accessCode    string
		tenantSlug    string
		tenantName    string
		publicQueueID string
	)
	err := s.db.QueryRowContext(ctx, `
		SELECT
			ac.barber_id,
			b.full_name,
			ac.role,
			ac.access_code,
			t.slug,
			t.name,
			t.public_queue_id
		FROM barber_access_credentials ac
		INNER JOIN barbers b ON b.id = ac.barber_id
		INNER JOIN tenants t ON t.id = ac.tenant_id
		WHERE ac.id = $1
		  AND ac.tenant_id = $2
		  AND ac.status = 'active'
		  AND t.status = 'active'
		LIMIT 1
	`, claims.UserID, claims.TenantID).Scan(
		&barberID,
		&barberName,
		&role,
		&accessCode,
		&tenantSlug,
		&tenantName,
		&publicQueueID,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Session{}, ErrCredentialInvalid
		}
		return Session{}, fmt.Errorf("load barber access profile: %w", err)
	}

	return Session{
		TokenType: "Bearer",
		Staff: StaffSummary{
			ID:         claims.UserID,
			BarberID:   barberID,
			FullName:   barberName,
			Role:       role,
			AccessCode: accessCode,
		},
		Tenant: TenantInfo{
			ID:             claims.TenantID,
			Slug:           tenantSlug,
			Name:           tenantName,
			PublicQueueID:  publicQueueID,
			PublicQueueURL: s.publicQueueURL(publicQueueID),
		},
	}, nil
}

func (s *Service) generateUniqueAccessCode(ctx context.Context, tx *sql.Tx) (string, error) {
	for range 8 {
		code, err := randomCode("BRB", 4)
		if err != nil {
			return "", err
		}

		var exists bool
		if err := tx.QueryRowContext(ctx, `
			SELECT EXISTS (
				SELECT 1
				FROM barber_access_credentials
				WHERE access_code = $1
			)
		`, code).Scan(&exists); err != nil {
			return "", err
		}
		if !exists {
			return code, nil
		}
	}

	return "", fmt.Errorf("unable to generate unique access code")
}

func (s *Service) publicQueueURL(publicQueueID string) string {
	if s.publicURL == "" || publicQueueID == "" {
		return ""
	}

	return s.publicURL + "/q/" + publicQueueID
}

func randomCode(prefix string, randomBytes int) (string, error) {
	buffer := make([]byte, randomBytes)
	if _, err := rand.Read(buffer); err != nil {
		return "", err
	}

	return fmt.Sprintf("%s-%s", strings.ToUpper(strings.TrimSpace(prefix)), strings.ToUpper(hex.EncodeToString(buffer))), nil
}

type sqlNullTime struct {
	target **time.Time
}

func (n *sqlNullTime) Scan(value any) error {
	if value == nil {
		*n.target = nil
		return nil
	}

	switch typed := value.(type) {
	case time.Time:
		v := typed.UTC()
		*n.target = &v
		return nil
	default:
		return fmt.Errorf("unsupported time value %T", value)
	}
}
