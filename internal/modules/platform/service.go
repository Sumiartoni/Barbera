package platform

import (
	"context"
	"database/sql"
	"fmt"
	"time"
)

type Service struct {
	db *sql.DB
}

func NewService(db *sql.DB) *Service {
	return &Service{db: db}
}

func (s *Service) Overview(ctx context.Context) (Overview, error) {
	result := Overview{}

	if err := s.db.QueryRowContext(ctx, `
		SELECT
			COUNT(*)::int AS total_tenants,
			COUNT(*) FILTER (
				WHERE COALESCE(p.code, 'free') <> 'free'
			)::int AS paid_tenants,
			COUNT(*) FILTER (
				WHERE COALESCE(p.code, 'free') = 'free'
			)::int AS free_tenants,
			COALESCE(
				SUM(
					COALESCE(ts.custom_monthly_price_idr, p.monthly_price_idr)
				) FILTER (
					WHERE ts.status IN ('active', 'trial', 'grace')
				),
				0
			)::bigint AS estimated_mrr_idr
		FROM tenants t
		LEFT JOIN LATERAL (
			SELECT plan_id, custom_monthly_price_idr, status
			FROM tenant_subscriptions
			WHERE tenant_id = t.id
			ORDER BY created_at DESC
			LIMIT 1
		) ts ON TRUE
		LEFT JOIN plans p ON p.id = ts.plan_id
		WHERE t.status IN ('active', 'pending', 'suspended')
	`).Scan(
		&result.Stats.TotalTenants,
		&result.Stats.PaidTenants,
		&result.Stats.FreeTenants,
		&result.Stats.EstimatedMRRIDR,
	); err != nil {
		return Overview{}, fmt.Errorf("query platform overview stats: %w", err)
	}

	if err := s.db.QueryRowContext(ctx, `
		SELECT
			(SELECT COUNT(*)::int FROM outlets),
			(SELECT COUNT(*)::int FROM customers),
			(SELECT COUNT(*)::int FROM visits WHERE visit_at >= NOW() - INTERVAL '30 days'),
			(SELECT COUNT(*)::int FROM visits WHERE next_reminder_at >= NOW() AND next_reminder_at <= NOW() + INTERVAL '7 days')
	`).Scan(
		&result.Stats.TotalOutlets,
		&result.Stats.TotalCustomers,
		&result.Stats.TotalVisits30d,
		&result.Stats.PendingReminders7d,
	); err != nil {
		return Overview{}, fmt.Errorf("query platform customer stats: %w", err)
	}

	tenants, err := s.ListTenants(ctx, 8)
	if err != nil {
		return Overview{}, err
	}
	result.Tenants = tenants

	logs, err := s.ListAuditLogs(ctx, 12)
	if err != nil {
		return Overview{}, err
	}
	result.RecentLogs = logs

	return result, nil
}

func (s *Service) ListTenants(ctx context.Context, limit int) ([]TenantSummary, error) {
	if limit <= 0 || limit > 100 {
		limit = 25
	}

	rows, err := s.db.QueryContext(ctx, `
		SELECT
			t.id,
			t.name,
			t.slug,
			t.status,
			COALESCE(p.code, 'free') AS plan_code,
			t.public_queue_id,
			t.created_at,
			ts.current_period_end,
			COALESCE(o.outlet_count, 0)::int,
			COALESCE(c.customer_count, 0)::int,
			COALESCE(b.barber_count, 0)::int,
			COALESCE(st.station_count, 0)::int,
			COALESCE(v.visit_count_30d, 0)::int,
			COALESCE(v.revenue_30d_idr, 0)::bigint
		FROM tenants t
		LEFT JOIN LATERAL (
			SELECT plan_id, current_period_end
			FROM tenant_subscriptions
			WHERE tenant_id = t.id
			ORDER BY created_at DESC
			LIMIT 1
		) ts ON TRUE
		LEFT JOIN plans p ON p.id = ts.plan_id
		LEFT JOIN (
			SELECT tenant_id, COUNT(*) AS outlet_count
			FROM outlets
			WHERE status <> 'archived'
			GROUP BY tenant_id
		) o ON o.tenant_id = t.id
		LEFT JOIN (
			SELECT tenant_id, COUNT(*) AS customer_count
			FROM customers
			GROUP BY tenant_id
		) c ON c.tenant_id = t.id
		LEFT JOIN (
			SELECT tenant_id, COUNT(*) AS barber_count
			FROM barbers
			WHERE status = 'active'
			GROUP BY tenant_id
		) b ON b.tenant_id = t.id
		LEFT JOIN (
			SELECT tenant_id, COUNT(*) AS station_count
			FROM stations
			WHERE status = 'active'
			GROUP BY tenant_id
		) st ON st.tenant_id = t.id
		LEFT JOIN (
			SELECT
				tenant_id,
				COUNT(*) FILTER (WHERE visit_at >= NOW() - INTERVAL '30 days') AS visit_count_30d,
				COALESCE(SUM(amount_idr) FILTER (
					WHERE payment_status = 'paid' AND visit_at >= NOW() - INTERVAL '30 days'
				), 0) AS revenue_30d_idr
			FROM visits
			GROUP BY tenant_id
		) v ON v.tenant_id = t.id
		ORDER BY t.created_at DESC
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, fmt.Errorf("query platform tenants: %w", err)
	}
	defer rows.Close()

	tenants := make([]TenantSummary, 0, limit)
	for rows.Next() {
		var (
			record           TenantSummary
			currentPeriodEnd sql.NullTime
		)
		if err := rows.Scan(
			&record.ID,
			&record.Name,
			&record.Slug,
			&record.Status,
			&record.PlanCode,
			&record.PublicQueueID,
			&record.CreatedAt,
			&currentPeriodEnd,
			&record.Outlets,
			&record.Customers,
			&record.Barbers,
			&record.Stations,
			&record.Visits30d,
			&record.Revenue30dIDR,
		); err != nil {
			return nil, fmt.Errorf("scan platform tenant: %w", err)
		}
		if currentPeriodEnd.Valid {
			value := currentPeriodEnd.Time.UTC()
			record.CurrentPeriodEnd = &value
		}
		tenants = append(tenants, record)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate platform tenants: %w", err)
	}

	return tenants, nil
}

func (s *Service) ListAuditLogs(ctx context.Context, limit int) ([]AuditEntry, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	rows, err := s.db.QueryContext(ctx, `
		SELECT id, COALESCE(tenant_id::text, ''), action, target_type, target_id, created_at
		FROM audit_logs
		ORDER BY created_at DESC
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, fmt.Errorf("query platform audit logs: %w", err)
	}
	defer rows.Close()

	logs := make([]AuditEntry, 0, limit)
	for rows.Next() {
		var entry AuditEntry
		if err := rows.Scan(
			&entry.ID,
			&entry.TenantID,
			&entry.Action,
			&entry.TargetType,
			&entry.TargetID,
			&entry.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan platform audit log: %w", err)
		}
		logs = append(logs, entry)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate platform audit logs: %w", err)
	}

	return logs, nil
}

func (s *Service) SystemStatus(ctx context.Context) (SystemStatus, error) {
	status := SystemStatus{Database: "unknown"}
	if err := s.db.QueryRowContext(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE status = 'waiting')::int,
			COUNT(*) FILTER (WHERE status = 'in_service')::int
		FROM queue_tickets
	`).Scan(&status.TotalQueueWaiting, &status.TotalQueueServing); err != nil {
		return SystemStatus{}, fmt.Errorf("query queue status: %w", err)
	}

	if err := s.db.QueryRowContext(ctx, `
		SELECT
			(SELECT COUNT(*)::int FROM stations WHERE status = 'active'),
			(SELECT COUNT(*)::int FROM barber_shifts WHERE status = 'scheduled' AND starts_at <= NOW() AND ends_at > NOW())
	`).Scan(&status.ActiveStations, &status.BarbersOnShift); err != nil {
		return SystemStatus{}, fmt.Errorf("query operational system status: %w", err)
	}

	if err := s.db.PingContext(ctx); err != nil {
		status.Database = "degraded"
	} else {
		status.Database = "healthy"
	}
	status.LastCheckedAt = time.Now().UTC()

	return status, nil
}

func (s *Service) AssignTenantPlan(ctx context.Context, tenantID string, planCode string) error {
	if tenantID == "" || planCode == "" {
		return fmt.Errorf("assign tenant plan: tenantID and planCode are required")
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin assign tenant plan tx: %w", err)
	}
	defer tx.Rollback()

	var (
		planID string
		isFree bool
	)
	if err := tx.QueryRowContext(ctx, `
		SELECT id, is_free
		FROM plans
		WHERE code = $1
		  AND is_active = TRUE
		LIMIT 1
	`, planCode).Scan(&planID, &isFree); err != nil {
		return fmt.Errorf("load target plan: %w", err)
	}

	var currentTenantID string
	if err := tx.QueryRowContext(ctx, `
		SELECT id
		FROM tenants
		WHERE id = $1
		LIMIT 1
	`, tenantID).Scan(&currentTenantID); err != nil {
		return fmt.Errorf("load tenant: %w", err)
	}

	var currentPeriodEnd any
	if !isFree {
		currentPeriodEnd = time.Now().UTC().Add(30 * 24 * time.Hour)
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
		VALUES ($1, $2, 'active', 'admin_override', NOW(), $3)
	`, tenantID, planID, currentPeriodEnd); err != nil {
		return fmt.Errorf("insert overridden subscription: %w", err)
	}

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO audit_logs (tenant_id, action, target_type, target_id, metadata)
		VALUES ($1::uuid, 'platform.tenant_plan_assigned', 'tenant_subscription', $2::text, jsonb_build_object('plan_code', $3::text))
	`, tenantID, tenantID, planCode); err != nil {
		return fmt.Errorf("insert platform audit log: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit assign tenant plan: %w", err)
	}

	return nil
}

func (s *Service) UpdateTenantStatus(ctx context.Context, tenantID string, status string) error {
	if tenantID == "" || status == "" {
		return fmt.Errorf("update tenant status: tenantID and status are required")
	}

	if _, err := s.db.ExecContext(ctx, `
		UPDATE tenants
		SET status = $2,
			updated_at = NOW()
		WHERE id = $1
	`, tenantID, status); err != nil {
		return fmt.Errorf("update tenant status row: %w", err)
	}

	if _, err := s.db.ExecContext(ctx, `
		INSERT INTO audit_logs (tenant_id, action, target_type, target_id, metadata)
		VALUES ($1::uuid, 'platform.tenant_status_updated', 'tenant', $2::text, jsonb_build_object('status', $3::text))
	`, tenantID, tenantID, status); err != nil {
		return fmt.Errorf("insert tenant status audit log: %w", err)
	}

	return nil
}
