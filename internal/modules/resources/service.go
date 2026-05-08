package resources

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
)

type Service struct {
	db *sql.DB
}

func NewService(db *sql.DB) *Service {
	return &Service{db: db}
}

func (s *Service) ListTenantItems(ctx context.Context, tenantID string, resourceType string) ([]ResourceItem, error) {
	if tenantID == "" || strings.TrimSpace(resourceType) == "" {
		return nil, ErrValidation
	}
	if err := s.ensureTenantResourceAllowed(ctx, tenantID, resourceType); err != nil {
		return nil, err
	}

	if err := s.ensureTenantResourceDefaults(ctx, tenantID, resourceType); err != nil {
		return nil, err
	}

	rows, err := s.db.QueryContext(ctx, `
		SELECT id, tenant_id, resource_type, name, status, config, created_at, updated_at
		FROM tenant_resource_items
		WHERE tenant_id = $1
		  AND resource_type = $2
		ORDER BY created_at DESC
	`, tenantID, strings.TrimSpace(resourceType))
	if err != nil {
		return nil, fmt.Errorf("query tenant resource items: %w", err)
	}
	defer rows.Close()

	items := make([]ResourceItem, 0, 16)
	for rows.Next() {
		item, err := scanTenantItem(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate tenant resource items: %w", err)
	}

	return items, nil
}

func (s *Service) ensureTenantResourceDefaults(ctx context.Context, tenantID string, resourceType string) error {
	resourceType = strings.TrimSpace(resourceType)
	if resourceType != "message_template" && resourceType != "reminder_rule" {
		return nil
	}

	var count int
	if err := s.db.QueryRowContext(ctx, `
		SELECT COUNT(*)
		FROM tenant_resource_items
		WHERE tenant_id = $1
		  AND resource_type = $2
	`, tenantID, resourceType).Scan(&count); err != nil {
		return fmt.Errorf("count tenant default resources: %w", err)
	}
	if count > 0 {
		return nil
	}

	var tenantName string
	if err := s.db.QueryRowContext(ctx, `
		SELECT name
		FROM tenants
		WHERE id = $1
		LIMIT 1
	`, tenantID).Scan(&tenantName); err != nil {
		return fmt.Errorf("load tenant for default resources: %w", err)
	}

	defaults := defaultTenantResources(resourceType, tenantName)
	for _, item := range defaults {
		rawConfig, err := marshalConfig(item.Config)
		if err != nil {
			return err
		}
		if _, err := s.db.ExecContext(ctx, `
			INSERT INTO tenant_resource_items (tenant_id, resource_type, name, status, config)
			VALUES ($1, $2, $3, $4, $5::jsonb)
		`, tenantID, resourceType, item.Name, item.Status, rawConfig); err != nil {
			return fmt.Errorf("insert default tenant resource: %w", err)
		}
	}

	return nil
}

func defaultTenantResources(resourceType string, tenantName string) []ResourceInput {
	switch resourceType {
	case "reminder_rule":
		return []ResourceInput{
			{
				Name:   "Reminder 21 Hari",
				Status: "active",
				Config: map[string]any{
					"days_after_visit": 21,
					"channel":          "whatsapp",
					"message":          "Halo {{name}}, biasanya sudah waktunya rapikan rambut lagi. Balas pesan ini kalau mau booking atau minta link antrean.",
				},
			},
		}
	case "message_template":
		return []ResourceInput{
			{
				Name:   "Template Link Antrean",
				Status: "active",
				Config: map[string]any{
					"channel": "whatsapp",
					"purpose": "queue_link",
					"content": fmt.Sprintf("Halo {{name}}, ini link antrean live %s: {{queue_link}}. Pantau nomor antrean Anda secara real-time ya.", tenantName),
				},
			},
			{
				Name:   "Template Reminder Cukur Ulang",
				Status: "active",
				Config: map[string]any{
					"channel": "whatsapp",
					"purpose": "reminder",
					"content": "Halo {{name}}, sudah waktunya pangkas lagi. Kalau mau dengan barber favorit Anda, balas pesan ini atau minta link antrean.",
				},
			},
			{
				Name:   "Template Win-back 30 Hari",
				Status: "active",
				Config: map[string]any{
					"channel": "whatsapp",
					"purpose": "winback",
					"content": "Halo {{name}}, sudah lama belum mampir lagi. Minggu ini kami siap bantu rapikan style Anda. Balas pesan ini untuk pilih barber atau minta link antrean.",
				},
			},
			{
				Name:   "Template Minta Review",
				Status: "active",
				Config: map[string]any{
					"channel": "whatsapp",
					"purpose": "review_request",
					"content": "Terima kasih sudah datang ke {{barbershop_name}}. Kalau berkenan, bantu kasih review singkat ya: {{google_review_url}}",
				},
			},
		}
	}
	return nil
}

func (s *Service) CreateTenantItem(ctx context.Context, tenantID string, resourceType string, input ResourceInput) (ResourceItem, error) {
	if tenantID == "" || strings.TrimSpace(resourceType) == "" || strings.TrimSpace(input.Name) == "" {
		return ResourceItem{}, ErrValidation
	}
	if err := s.ensureTenantResourceAllowed(ctx, tenantID, resourceType); err != nil {
		return ResourceItem{}, err
	}

	configJSON, err := marshalConfig(input.Config)
	if err != nil {
		return ResourceItem{}, err
	}

	item := ResourceItem{}
	err = s.db.QueryRowContext(ctx, `
		INSERT INTO tenant_resource_items (tenant_id, resource_type, name, status, config)
		VALUES ($1, $2, $3, COALESCE(NULLIF($4, ''), 'active'), $5::jsonb)
		RETURNING id, tenant_id, resource_type, name, status, config, created_at, updated_at
	`, tenantID, strings.TrimSpace(resourceType), strings.TrimSpace(input.Name), strings.TrimSpace(input.Status), configJSON).Scan(
		&item.ID,
		&item.TenantID,
		&item.ResourceType,
		&item.Name,
		&item.Status,
		(*jsonRawScan)(&item.Config),
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	if err != nil {
		return ResourceItem{}, fmt.Errorf("insert tenant resource item: %w", err)
	}

	return item, nil
}

func (s *Service) UpdateTenantItem(ctx context.Context, tenantID string, resourceType string, itemID string, input ResourceInput) (ResourceItem, error) {
	if tenantID == "" || strings.TrimSpace(resourceType) == "" || strings.TrimSpace(itemID) == "" || strings.TrimSpace(input.Name) == "" {
		return ResourceItem{}, ErrValidation
	}
	if err := s.ensureTenantResourceAllowed(ctx, tenantID, resourceType); err != nil {
		return ResourceItem{}, err
	}

	configJSON, err := marshalConfig(input.Config)
	if err != nil {
		return ResourceItem{}, err
	}

	item := ResourceItem{}
	err = s.db.QueryRowContext(ctx, `
		UPDATE tenant_resource_items
		SET name = $4,
			status = COALESCE(NULLIF($5, ''), status),
			config = $6::jsonb,
			updated_at = NOW()
		WHERE tenant_id = $1
		  AND resource_type = $2
		  AND id = $3
		RETURNING id, tenant_id, resource_type, name, status, config, created_at, updated_at
	`, tenantID, strings.TrimSpace(resourceType), itemID, strings.TrimSpace(input.Name), strings.TrimSpace(input.Status), configJSON).Scan(
		&item.ID,
		&item.TenantID,
		&item.ResourceType,
		&item.Name,
		&item.Status,
		(*jsonRawScan)(&item.Config),
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ResourceItem{}, ErrNotFound
		}
		return ResourceItem{}, fmt.Errorf("update tenant resource item: %w", err)
	}

	return item, nil
}

func (s *Service) DeleteTenantItem(ctx context.Context, tenantID string, resourceType string, itemID string) error {
	if tenantID == "" || strings.TrimSpace(resourceType) == "" || strings.TrimSpace(itemID) == "" {
		return ErrValidation
	}
	if err := s.ensureTenantResourceAllowed(ctx, tenantID, resourceType); err != nil {
		return err
	}

	result, err := s.db.ExecContext(ctx, `
		DELETE FROM tenant_resource_items
		WHERE tenant_id = $1
		  AND resource_type = $2
		  AND id = $3
	`, tenantID, strings.TrimSpace(resourceType), itemID)
	if err != nil {
		return fmt.Errorf("delete tenant resource item: %w", err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("tenant resource rows affected: %w", err)
	}
	if affected == 0 {
		return ErrNotFound
	}

	return nil
}

func (s *Service) ListPlatformItems(ctx context.Context, resourceType string) ([]ResourceItem, error) {
	if strings.TrimSpace(resourceType) == "" {
		return nil, ErrValidation
	}

	rows, err := s.db.QueryContext(ctx, `
		SELECT id, resource_type, resource_key, name, status, config, created_at, updated_at
		FROM platform_resource_items
		WHERE resource_type = $1
		ORDER BY created_at DESC
	`, strings.TrimSpace(resourceType))
	if err != nil {
		return nil, fmt.Errorf("query platform resource items: %w", err)
	}
	defer rows.Close()

	items := make([]ResourceItem, 0, 16)
	for rows.Next() {
		item, err := scanPlatformItem(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate platform resource items: %w", err)
	}

	return items, nil
}

func (s *Service) CreatePlatformItem(ctx context.Context, resourceType string, input ResourceInput) (ResourceItem, error) {
	if strings.TrimSpace(resourceType) == "" || strings.TrimSpace(input.Name) == "" {
		return ResourceItem{}, ErrValidation
	}

	configJSON, err := marshalConfig(input.Config)
	if err != nil {
		return ResourceItem{}, err
	}

	item := ResourceItem{}
	err = s.db.QueryRowContext(ctx, `
		INSERT INTO platform_resource_items (resource_type, resource_key, name, status, config)
		VALUES ($1, $2, $3, COALESCE(NULLIF($4, ''), 'active'), $5::jsonb)
		RETURNING id, resource_type, resource_key, name, status, config, created_at, updated_at
	`, strings.TrimSpace(resourceType), strings.TrimSpace(input.ResourceKey), strings.TrimSpace(input.Name), strings.TrimSpace(input.Status), configJSON).Scan(
		&item.ID,
		&item.ResourceType,
		&item.ResourceKey,
		&item.Name,
		&item.Status,
		(*jsonRawScan)(&item.Config),
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	if err != nil {
		return ResourceItem{}, fmt.Errorf("insert platform resource item: %w", err)
	}

	return item, nil
}

func (s *Service) UpdatePlatformItem(ctx context.Context, resourceType string, itemID string, input ResourceInput) (ResourceItem, error) {
	if strings.TrimSpace(resourceType) == "" || strings.TrimSpace(itemID) == "" || strings.TrimSpace(input.Name) == "" {
		return ResourceItem{}, ErrValidation
	}

	configJSON, err := marshalConfig(input.Config)
	if err != nil {
		return ResourceItem{}, err
	}

	item := ResourceItem{}
	err = s.db.QueryRowContext(ctx, `
		UPDATE platform_resource_items
		SET resource_key = $3,
			name = $4,
			status = COALESCE(NULLIF($5, ''), status),
			config = $6::jsonb,
			updated_at = NOW()
		WHERE resource_type = $1
		  AND id = $2
		RETURNING id, resource_type, resource_key, name, status, config, created_at, updated_at
	`, strings.TrimSpace(resourceType), itemID, strings.TrimSpace(input.ResourceKey), strings.TrimSpace(input.Name), strings.TrimSpace(input.Status), configJSON).Scan(
		&item.ID,
		&item.ResourceType,
		&item.ResourceKey,
		&item.Name,
		&item.Status,
		(*jsonRawScan)(&item.Config),
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ResourceItem{}, ErrNotFound
		}
		return ResourceItem{}, fmt.Errorf("update platform resource item: %w", err)
	}

	return item, nil
}

func (s *Service) DeletePlatformItem(ctx context.Context, resourceType string, itemID string) error {
	if strings.TrimSpace(resourceType) == "" || strings.TrimSpace(itemID) == "" {
		return ErrValidation
	}

	result, err := s.db.ExecContext(ctx, `
		DELETE FROM platform_resource_items
		WHERE resource_type = $1
		  AND id = $2
	`, strings.TrimSpace(resourceType), itemID)
	if err != nil {
		return fmt.Errorf("delete platform resource item: %w", err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("platform resource rows affected: %w", err)
	}
	if affected == 0 {
		return ErrNotFound
	}

	return nil
}

func (s *Service) GetTenantConfig(ctx context.Context, tenantID string, configType string) (map[string]any, error) {
	if tenantID == "" || strings.TrimSpace(configType) == "" {
		return nil, ErrValidation
	}
	if err := s.ensureTenantConfigAllowed(ctx, tenantID, configType); err != nil {
		return nil, err
	}

	column, ok := tenantConfigColumn(configType)
	if !ok {
		return nil, ErrValidation
	}

	var raw []byte
	err := s.db.QueryRowContext(ctx, fmt.Sprintf(`
		INSERT INTO tenant_configurations (tenant_id)
		VALUES ($1)
		ON CONFLICT (tenant_id) DO NOTHING
		RETURNING %s
	`, column), tenantID).Scan(&raw)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			err = s.db.QueryRowContext(ctx, fmt.Sprintf(`
				SELECT %s
				FROM tenant_configurations
				WHERE tenant_id = $1
			`, column), tenantID).Scan(&raw)
		}
	}
	if err != nil {
		return nil, fmt.Errorf("load tenant config: %w", err)
	}

	return unmarshalConfig(raw)
}

func (s *Service) PutTenantConfig(ctx context.Context, tenantID string, configType string, config map[string]any) (map[string]any, error) {
	if tenantID == "" || strings.TrimSpace(configType) == "" {
		return nil, ErrValidation
	}
	if err := s.ensureTenantConfigAllowed(ctx, tenantID, configType); err != nil {
		return nil, err
	}

	column, ok := tenantConfigColumn(configType)
	if !ok {
		return nil, ErrValidation
	}

	configJSON, err := marshalConfig(config)
	if err != nil {
		return nil, err
	}

	var raw []byte
	err = s.db.QueryRowContext(ctx, fmt.Sprintf(`
		INSERT INTO tenant_configurations (tenant_id, %s, updated_at)
		VALUES ($1, $2::jsonb, NOW())
		ON CONFLICT (tenant_id)
		DO UPDATE SET %s = EXCLUDED.%s, updated_at = NOW()
		RETURNING %s
	`, column, column, column, column), tenantID, configJSON).Scan(&raw)
	if err != nil {
		return nil, fmt.Errorf("upsert tenant config: %w", err)
	}

	return unmarshalConfig(raw)
}

func (s *Service) GetPlatformConfig(ctx context.Context, configType string) (map[string]any, error) {
	if strings.TrimSpace(configType) == "" {
		return nil, ErrValidation
	}

	var raw []byte
	err := s.db.QueryRowContext(ctx, `
		SELECT config
		FROM platform_configurations
		WHERE config_key = $1
	`, strings.TrimSpace(configType)).Scan(&raw)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return map[string]any{}, nil
		}
		return nil, fmt.Errorf("load platform config: %w", err)
	}

	return unmarshalConfig(raw)
}

func (s *Service) PutPlatformConfig(ctx context.Context, configType string, config map[string]any) (map[string]any, error) {
	if strings.TrimSpace(configType) == "" {
		return nil, ErrValidation
	}

	configJSON, err := marshalConfig(config)
	if err != nil {
		return nil, err
	}

	var raw []byte
	err = s.db.QueryRowContext(ctx, `
		INSERT INTO platform_configurations (config_key, config, updated_at)
		VALUES ($1, $2::jsonb, NOW())
		ON CONFLICT (config_key)
		DO UPDATE SET config = EXCLUDED.config, updated_at = NOW()
		RETURNING config
	`, strings.TrimSpace(configType), configJSON).Scan(&raw)
	if err != nil {
		return nil, fmt.Errorf("upsert platform config: %w", err)
	}

	return unmarshalConfig(raw)
}

type jsonRawScan map[string]any

func (j *jsonRawScan) Scan(value any) error {
	if value == nil {
		*j = map[string]any{}
		return nil
	}

	raw, ok := value.([]byte)
	if !ok {
		return fmt.Errorf("unsupported json raw type %T", value)
	}

	config, err := unmarshalConfig(raw)
	if err != nil {
		return err
	}

	*j = config
	return nil
}

func scanTenantItem(scanner interface {
	Scan(dest ...any) error
}) (ResourceItem, error) {
	item := ResourceItem{}
	if err := scanner.Scan(
		&item.ID,
		&item.TenantID,
		&item.ResourceType,
		&item.Name,
		&item.Status,
		(*jsonRawScan)(&item.Config),
		&item.CreatedAt,
		&item.UpdatedAt,
	); err != nil {
		return ResourceItem{}, fmt.Errorf("scan tenant resource item: %w", err)
	}
	return item, nil
}

func scanPlatformItem(scanner interface {
	Scan(dest ...any) error
}) (ResourceItem, error) {
	item := ResourceItem{}
	if err := scanner.Scan(
		&item.ID,
		&item.ResourceType,
		&item.ResourceKey,
		&item.Name,
		&item.Status,
		(*jsonRawScan)(&item.Config),
		&item.CreatedAt,
		&item.UpdatedAt,
	); err != nil {
		return ResourceItem{}, fmt.Errorf("scan platform resource item: %w", err)
	}
	return item, nil
}

func marshalConfig(config map[string]any) ([]byte, error) {
	if config == nil {
		config = map[string]any{}
	}
	raw, err := json.Marshal(config)
	if err != nil {
		return nil, fmt.Errorf("marshal config: %w", err)
	}
	return raw, nil
}

func unmarshalConfig(raw []byte) (map[string]any, error) {
	if len(raw) == 0 {
		return map[string]any{}, nil
	}
	var config map[string]any
	if err := json.Unmarshal(raw, &config); err != nil {
		return nil, fmt.Errorf("unmarshal config: %w", err)
	}
	if config == nil {
		config = map[string]any{}
	}
	return config, nil
}

func tenantConfigColumn(configType string) (string, bool) {
	switch strings.TrimSpace(configType) {
	case "settings":
		return "settings", true
	case "integrations":
		return "integrations", true
	case "permissions":
		return "permissions", true
	case "loyalty":
		return "loyalty", true
	case "whatsapp":
		return "whatsapp", true
	default:
		return "", false
	}
}

func (s *Service) ensureTenantResourceAllowed(ctx context.Context, tenantID string, resourceType string) error {
	features, err := s.loadTenantPlanFeatures(ctx, tenantID)
	if err != nil {
		return err
	}
	switch strings.TrimSpace(resourceType) {
	case "campaign":
		if !features.AllowCampaigns {
			return ErrFeatureUnavailable
		}
	}
	return nil
}

func (s *Service) ensureTenantConfigAllowed(ctx context.Context, tenantID string, configType string) error {
	features, err := s.loadTenantPlanFeatures(ctx, tenantID)
	if err != nil {
		return err
	}
	switch strings.TrimSpace(configType) {
	case "loyalty":
		if !features.AllowLoyalty {
			return ErrFeatureUnavailable
		}
	}
	return nil
}

type tenantPlanFeatures struct {
	AllowCampaigns bool
	AllowLoyalty   bool
}

func (s *Service) loadTenantPlanFeatures(ctx context.Context, tenantID string) (tenantPlanFeatures, error) {
	features := tenantPlanFeatures{}
	if err := s.db.QueryRowContext(ctx, `
		SELECT
			COALESCE(pl.allow_campaigns, FALSE),
			COALESCE(pl.allow_loyalty, FALSE)
		FROM tenants t
		LEFT JOIN LATERAL (
			SELECT plan_id
			FROM tenant_subscriptions
			WHERE tenant_id = t.id
			  AND status IN ('active', 'trial', 'grace')
			ORDER BY created_at DESC
			LIMIT 1
		) ts ON TRUE
		LEFT JOIN plan_limits pl ON pl.plan_id = ts.plan_id
		WHERE t.id = $1
	`, tenantID).Scan(&features.AllowCampaigns, &features.AllowLoyalty); err != nil {
		return tenantPlanFeatures{}, fmt.Errorf("load tenant plan features: %w", err)
	}
	return features, nil
}
