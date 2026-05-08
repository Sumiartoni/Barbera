package auth

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"
)

type Service struct {
	db          *sql.DB
	tokenIssuer *tokenIssuer
	publicURL   string
}

type loginRecord struct {
	UserID        string
	Email         string
	FullName      string
	PhoneNumber   string
	PasswordHash  string
	TenantID      string
	TenantSlug    string
	TenantName    string
	PublicQueueID string
	Role          string
	PlanCode      string
}

var slugCleaner = regexp.MustCompile(`[^a-z0-9]+`)

func NewService(db *sql.DB, signingKey string, accessTokenTTL time.Duration, publicURL string) *Service {
	return &Service{
		db:          db,
		tokenIssuer: newTokenIssuer(signingKey, accessTokenTTL),
		publicURL:   strings.TrimRight(strings.TrimSpace(publicURL), "/"),
	}
}

func (s *Service) Register(ctx context.Context, input RegisterInput) (AuthResult, error) {
	input.BarbershopName = strings.TrimSpace(input.BarbershopName)
	input.FullName = strings.TrimSpace(input.FullName)
	input.Email = normalizeEmail(input.Email)
	input.PhoneNumber = strings.TrimSpace(input.PhoneNumber)

	if input.BarbershopName == "" || input.FullName == "" || input.Email == "" || len(input.Password) < 8 {
		return AuthResult{}, ErrValidation
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return AuthResult{}, fmt.Errorf("begin register tx: %w", err)
	}
	defer tx.Rollback()

	var existingEmail string
	err = tx.QueryRowContext(ctx, `SELECT email FROM users WHERE email = $1`, input.Email).Scan(&existingEmail)
	if err == nil {
		return AuthResult{}, ErrEmailAlreadyUsed
	}
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return AuthResult{}, fmt.Errorf("check email uniqueness: %w", err)
	}

	var freePlanID string
	var freePlanCode string
	err = tx.QueryRowContext(ctx, `
		SELECT id, code
		FROM plans
		WHERE code = 'free' AND is_active = TRUE
		LIMIT 1
	`).Scan(&freePlanID, &freePlanCode)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return AuthResult{}, ErrFreePlanMissing
		}
		return AuthResult{}, fmt.Errorf("load free plan: %w", err)
	}

	passwordHash, err := hashPassword(input.Password)
	if err != nil {
		return AuthResult{}, fmt.Errorf("hash password: %w", err)
	}

	tenantSlug, err := s.uniqueTenantSlug(ctx, tx, input.BarbershopName)
	if err != nil {
		return AuthResult{}, fmt.Errorf("generate tenant slug: %w", err)
	}

	var tenantID string
	err = tx.QueryRowContext(ctx, `
		INSERT INTO tenants (slug, name, public_queue_id, status)
		VALUES ($1, $2, $3, 'active')
		RETURNING id
	`, tenantSlug, input.BarbershopName, tenantSlug).Scan(&tenantID)
	if err != nil {
		return AuthResult{}, fmt.Errorf("insert tenant: %w", err)
	}

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO outlets (tenant_id, name, code, is_primary)
		VALUES ($1, $2, 'HQ', TRUE)
	`, tenantID, fmt.Sprintf("%s - Outlet Utama", input.BarbershopName)); err != nil {
		return AuthResult{}, fmt.Errorf("insert primary outlet: %w", err)
	}

	var userID string
	err = tx.QueryRowContext(ctx, `
		INSERT INTO users (email, full_name, phone_number, password_hash, status)
		VALUES ($1, $2, $3, $4, 'active')
		RETURNING id
	`, input.Email, input.FullName, input.PhoneNumber, passwordHash).Scan(&userID)
	if err != nil {
		return AuthResult{}, fmt.Errorf("insert user: %w", err)
	}

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO tenant_memberships (tenant_id, user_id, role, is_primary)
		VALUES ($1, $2, 'owner', TRUE)
	`, tenantID, userID); err != nil {
		return AuthResult{}, fmt.Errorf("insert tenant membership: %w", err)
	}

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO tenant_subscriptions (
			tenant_id,
			plan_id,
			status,
			source,
			current_period_start,
			current_period_end
		)
		VALUES ($1, $2, 'active', 'system', NOW(), NULL)
	`, tenantID, freePlanID); err != nil {
		return AuthResult{}, fmt.Errorf("insert tenant subscription: %w", err)
	}

	if err := s.seedTenantDefaults(ctx, tx, tenantID, input.BarbershopName, input.FullName, input.PhoneNumber, tenantSlug); err != nil {
		return AuthResult{}, fmt.Errorf("seed tenant defaults: %w", err)
	}

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO audit_logs (tenant_id, actor_user_id, action, target_type, target_id, metadata)
		VALUES ($1, $2, 'tenant.registered', 'tenant', $4, jsonb_build_object('plan_code', $3::text))
	`, tenantID, userID, freePlanCode, tenantID); err != nil {
		return AuthResult{}, fmt.Errorf("insert audit log: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return AuthResult{}, fmt.Errorf("commit register tx: %w", err)
	}

	token, expiresAt, err := s.tokenIssuer.Issue(userID, tenantID, "owner")
	if err != nil {
		return AuthResult{}, fmt.Errorf("issue token: %w", err)
	}

	return AuthResult{
		AccessToken: token,
		TokenType:   "Bearer",
		ExpiresAt:   expiresAt,
		User: UserSummary{
			ID:          userID,
			Email:       input.Email,
			FullName:    input.FullName,
			PhoneNumber: input.PhoneNumber,
			Role:        "owner",
		},
		Tenant: TenantSummary{
			ID:            tenantID,
			Slug:          tenantSlug,
			Name:          input.BarbershopName,
			PublicQueueID: tenantSlug,
		},
		PlanCode: freePlanCode,
	}, nil
}

func (s *Service) Login(ctx context.Context, input LoginInput) (AuthResult, error) {
	input.Email = normalizeEmail(input.Email)

	if input.Email == "" || input.Password == "" {
		return AuthResult{}, ErrValidation
	}

	record, err := s.getLoginRecord(ctx, input.Email)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return AuthResult{}, ErrInvalidCredential
		}
		return AuthResult{}, fmt.Errorf("load user for login: %w", err)
	}

	if err := verifyPassword(record.PasswordHash, input.Password); err != nil {
		return AuthResult{}, ErrInvalidCredential
	}

	if _, err := s.db.ExecContext(ctx, `
		UPDATE users
		SET last_login_at = NOW(), updated_at = NOW()
		WHERE id = $1
	`, record.UserID); err != nil {
		return AuthResult{}, fmt.Errorf("update last login: %w", err)
	}

	token, expiresAt, err := s.tokenIssuer.Issue(record.UserID, record.TenantID, record.Role)
	if err != nil {
		return AuthResult{}, fmt.Errorf("issue token: %w", err)
	}

	return AuthResult{
		AccessToken: token,
		TokenType:   "Bearer",
		ExpiresAt:   expiresAt,
		User: UserSummary{
			ID:          record.UserID,
			Email:       record.Email,
			FullName:    record.FullName,
			PhoneNumber: record.PhoneNumber,
			Role:        record.Role,
		},
		Tenant: TenantSummary{
			ID:            record.TenantID,
			Slug:          record.TenantSlug,
			Name:          record.TenantName,
			PublicQueueID: record.PublicQueueID,
		},
		PlanCode: record.PlanCode,
	}, nil
}

func (s *Service) ParseToken(rawToken string) (AuthClaims, error) {
	return s.tokenIssuer.Parse(rawToken)
}

func (s *Service) IssueForActor(subjectID string, tenantID string, role string, actorType string) (string, time.Time, error) {
	return s.tokenIssuer.IssueForActor(subjectID, tenantID, role, actorType)
}

func (s *Service) GetProfile(ctx context.Context, claims AuthClaims) (AuthProfile, error) {
	record, err := s.getProfileRecord(ctx, claims.UserID, claims.TenantID)
	if err != nil {
		return AuthProfile{}, err
	}

	return AuthProfile{
		User: UserSummary{
			ID:          record.UserID,
			Email:       record.Email,
			FullName:    record.FullName,
			PhoneNumber: record.PhoneNumber,
			Role:        record.Role,
		},
		Tenant: TenantSummary{
			ID:            record.TenantID,
			Slug:          record.TenantSlug,
			Name:          record.TenantName,
			PublicQueueID: record.PublicQueueID,
		},
		PlanCode: record.PlanCode,
	}, nil
}

func (s *Service) getLoginRecord(ctx context.Context, email string) (loginRecord, error) {
	var record loginRecord

	err := s.db.QueryRowContext(ctx, `
		SELECT
			u.id,
			u.email,
			u.full_name,
			u.phone_number,
			u.password_hash,
			t.id,
			t.slug,
			t.name,
			t.public_queue_id,
			tm.role,
			COALESCE(p.code, 'free')
		FROM users u
		INNER JOIN tenant_memberships tm ON tm.user_id = u.id
		INNER JOIN tenants t ON t.id = tm.tenant_id
		LEFT JOIN tenant_subscriptions ts
			ON ts.tenant_id = t.id
			AND ts.status IN ('active', 'trial', 'grace')
		LEFT JOIN plans p ON p.id = ts.plan_id
		WHERE u.email = $1
			AND u.status = 'active'
			AND t.status = 'active'
		ORDER BY tm.is_primary DESC, ts.created_at DESC NULLS LAST
		LIMIT 1
	`, email).Scan(
		&record.UserID,
		&record.Email,
		&record.FullName,
		&record.PhoneNumber,
		&record.PasswordHash,
		&record.TenantID,
		&record.TenantSlug,
		&record.TenantName,
		&record.PublicQueueID,
		&record.Role,
		&record.PlanCode,
	)

	return record, err
}

func (s *Service) getProfileRecord(ctx context.Context, userID string, tenantID string) (loginRecord, error) {
	var record loginRecord

	err := s.db.QueryRowContext(ctx, `
		SELECT
			u.id,
			u.email,
			u.full_name,
			u.phone_number,
			'' as password_hash,
			t.id,
			t.slug,
			t.name,
			t.public_queue_id,
			tm.role,
			COALESCE(p.code, 'free')
		FROM users u
		INNER JOIN tenant_memberships tm ON tm.user_id = u.id
		INNER JOIN tenants t ON t.id = tm.tenant_id
		LEFT JOIN tenant_subscriptions ts
			ON ts.tenant_id = t.id
			AND ts.status IN ('active', 'trial', 'grace')
		LEFT JOIN plans p ON p.id = ts.plan_id
		WHERE u.id = $1
			AND t.id = $2
			AND u.status = 'active'
		ORDER BY ts.created_at DESC NULLS LAST
		LIMIT 1
	`, userID, tenantID).Scan(
		&record.UserID,
		&record.Email,
		&record.FullName,
		&record.PhoneNumber,
		&record.PasswordHash,
		&record.TenantID,
		&record.TenantSlug,
		&record.TenantName,
		&record.PublicQueueID,
		&record.Role,
		&record.PlanCode,
	)

	return record, err
}

func (s *Service) uniqueTenantSlug(ctx context.Context, tx *sql.Tx, source string) (string, error) {
	base := slugify(source)
	if base == "" {
		base = "tenant"
	}

	candidates := []string{
		base,
		fmt.Sprintf("%s-%d", base, time.Now().UTC().Unix()%100000),
	}

	for _, candidate := range candidates {
		var exists bool
		if err := tx.QueryRowContext(ctx, `
			SELECT EXISTS (
				SELECT 1 FROM tenants WHERE slug = $1
			)
		`, candidate).Scan(&exists); err != nil {
			return "", err
		}

		if !exists {
			return candidate, nil
		}
	}

	return fmt.Sprintf("%s-%d", base, time.Now().UTC().UnixNano()%1000000), nil
}

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func slugify(raw string) string {
	result := strings.ToLower(strings.TrimSpace(raw))
	result = slugCleaner.ReplaceAllString(result, "-")
	result = strings.Trim(result, "-")
	return result
}

func (s *Service) seedTenantDefaults(
	ctx context.Context,
	tx *sql.Tx,
	tenantID string,
	barbershopName string,
	ownerName string,
	phoneNumber string,
	publicQueueID string,
) error {
	settings := map[string]any{
		"business_display_name":  barbershopName,
		"business_phone":         phoneNumber,
		"business_email":         "",
		"business_address":       "",
		"city":                   "",
		"timezone":               "Asia/Jakarta",
		"opening_hours":          "10:00 - 21:00",
		"booking_window_days":    "14",
		"booking_buffer_minutes": "10",
		"grace_period_minutes":   "10",
		"queue_display_note":     "Datang 10 menit sebelum giliran agar antrean tetap lancar.",
		"welcome_message":        fmt.Sprintf("Selamat datang di %s.", barbershopName),
		"booking_notes":          "Mohon datang sesuai slot atau antrean yang dipilih.",
		"late_policy":            "Keterlambatan lebih dari 10 menit dapat menggeser giliran.",
		"reschedule_policy":      "Perubahan jadwal sebaiknya dilakukan maksimal H-1.",
		"queue_call_message":     "Nomor {{queue_number}}, silakan menuju kursi {{station_name}}.",
		"google_review_url":      "",
		"instagram_handle":       "",
	}
	integrations := map[string]any{
		"public_queue_enabled":      "true",
		"public_queue_domain":       s.publicQueueURL(publicQueueID),
		"android_forwarder_url":     "",
		"android_forwarder_secret":  "",
		"owner_command_webhook_url": s.ownerCommandWebhookURL(publicQueueID),
		"qris_label":                "QRIS Utama Owner",
		"qris_callback_phone":       phoneNumber,
		"webhook_url":               "",
		"webhook_events":            "queue.created,queue.called,shift.updated",
		"google_calendar_enabled":   "false",
		"meta_ads_pixel_id":         "",
		"maps_url":                  "",
	}
	loyalty := map[string]any{
		"enabled":          "false",
		"visit_target":     5,
		"reward_label":     "Gratis 1 kali potong",
		"points_per_visit": 10,
	}
	permissions := defaultPermissionMatrix()
	whatsapp := map[string]any{
		"linked_number":           phoneNumber,
		"linked_name":             ownerName,
		"owner_commands_enabled":  false,
		"android_webhook_url":     "",
		"android_webhook_secret":  "",
		"default_queue_message":   fmt.Sprintf("Halo, ini link antrean live %s: {{queue_link}}", barbershopName),
		"default_reminder_footer": "Kirim HELP dari chat Message Yourself untuk melihat daftar command owner.",
	}

	settingsJSON, err := json.Marshal(settings)
	if err != nil {
		return err
	}
	integrationsJSON, err := json.Marshal(integrations)
	if err != nil {
		return err
	}
	loyaltyJSON, err := json.Marshal(loyalty)
	if err != nil {
		return err
	}
	permissionsJSON, err := json.Marshal(permissions)
	if err != nil {
		return err
	}
	whatsappJSON, err := json.Marshal(whatsapp)
	if err != nil {
		return err
	}

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO tenant_configurations (tenant_id, settings, integrations, loyalty, permissions, whatsapp, updated_at)
		VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, NOW())
		ON CONFLICT (tenant_id)
		DO UPDATE SET
			settings = EXCLUDED.settings,
			integrations = EXCLUDED.integrations,
			loyalty = EXCLUDED.loyalty,
			permissions = EXCLUDED.permissions,
			whatsapp = EXCLUDED.whatsapp,
			updated_at = NOW()
	`, tenantID, settingsJSON, integrationsJSON, loyaltyJSON, permissionsJSON, whatsappJSON); err != nil {
		return err
	}

	defaultResources := []struct {
		resourceType string
		name         string
		status       string
		config       map[string]any
	}{
		{
			resourceType: "service",
			name:         "Potong Rambut Regular",
			status:       "active",
			config: map[string]any{
				"base_price_idr":   35000,
				"duration_minutes": 45,
				"description":      "Layanan potong rambut reguler untuk pelanggan harian.",
			},
		},
		{
			resourceType: "service",
			name:         "Potong + Cuci",
			status:       "active",
			config: map[string]any{
				"base_price_idr":   50000,
				"duration_minutes": 60,
				"description":      "Potong rambut dan cuci untuk pengalaman lebih lengkap.",
			},
		},
		{
			resourceType: "reminder_rule",
			name:         "Reminder 21 Hari",
			status:       "active",
			config: map[string]any{
				"days_after_visit": 21,
				"channel":          "whatsapp",
				"message":          "Halo {{name}}, biasanya sudah waktunya rapikan rambut lagi. Balas pesan ini kalau mau booking atau minta link antrean.",
			},
		},
		{
			resourceType: "message_template",
			name:         "Template Link Antrean",
			status:       "active",
			config: map[string]any{
				"channel": "whatsapp",
				"purpose": "queue_link",
				"content": fmt.Sprintf("Halo {{name}}, ini link antrean live %s: {{queue_link}}. Pantau nomor antrean Anda secara real-time ya.", barbershopName),
			},
		},
		{
			resourceType: "message_template",
			name:         "Template Reminder Cukur Ulang",
			status:       "active",
			config: map[string]any{
				"channel": "whatsapp",
				"purpose": "reminder",
				"content": "Halo {{name}}, sudah waktunya pangkas lagi. Kalau mau dengan barber favorit Anda, balas pesan ini atau minta link antrean.",
			},
		},
		{
			resourceType: "message_template",
			name:         "Template Menu WhatsApp Customer",
			status:       "active",
			config: map[string]any{
				"channel": "whatsapp",
				"purpose": "customer_menu",
				"content": "Halo {{name}}, selamat datang di {{barbershop_name}}.\n1. Ambil link antrean live\n2. Pilih barber favorit\n3. Lihat barber yang tersedia\n4. Hubungi admin",
			},
		},
		{
			resourceType: "message_template",
			name:         "Template Win-back 30 Hari",
			status:       "active",
			config: map[string]any{
				"channel": "whatsapp",
				"purpose": "winback",
				"content": "Halo {{name}}, sudah lama belum mampir lagi. Minggu ini kami siap bantu rapikan style Anda. Balas pesan ini untuk pilih barber atau minta link antrean.",
			},
		},
		{
			resourceType: "message_template",
			name:         "Template Minta Review",
			status:       "active",
			config: map[string]any{
				"channel": "whatsapp",
				"purpose": "review_request",
				"content": "Terima kasih sudah datang ke {{barbershop_name}}. Kalau berkenan, bantu kasih review singkat ya: {{google_review_url}}",
			},
		},
	}

	for _, item := range defaultResources {
		rawConfig, err := json.Marshal(item.config)
		if err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO tenant_resource_items (tenant_id, resource_type, name, status, config)
			VALUES ($1, $2, $3, $4, $5::jsonb)
		`, tenantID, item.resourceType, item.name, item.status, rawConfig); err != nil {
			return err
		}
	}

	return nil
}

func (s *Service) publicQueueURL(publicQueueID string) string {
	if s.publicURL == "" || publicQueueID == "" {
		return ""
	}
	return s.publicURL + "/q/" + publicQueueID
}

func (s *Service) ownerCommandWebhookURL(publicQueueID string) string {
	if s.publicURL == "" || publicQueueID == "" {
		return ""
	}
	return s.publicURL + "/api/v1/public/whatsapp/owner-command/" + publicQueueID
}

func defaultPermissionMatrix() map[string]map[string]bool {
	return map[string]map[string]bool{
		"owner": {
			"dashboard": true, "customers": true, "visits": true, "queue": true, "barbers": true,
			"shifts": true, "billing": true, "whatsapp": true, "reports": true, "settings": true,
		},
		"admin": {
			"dashboard": true, "customers": true, "visits": true, "queue": true, "barbers": true,
			"shifts": true, "billing": false, "whatsapp": true, "reports": true, "settings": false,
		},
		"cashier": {
			"dashboard": true, "customers": true, "visits": true, "queue": true, "barbers": false,
			"shifts": false, "billing": false, "whatsapp": false, "reports": false, "settings": false,
		},
		"barber": {
			"dashboard": false, "customers": false, "visits": false, "queue": true, "barbers": false,
			"shifts": true, "billing": false, "whatsapp": false, "reports": false, "settings": false,
		},
	}
}
