package usage

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

func (s *Service) Summary(ctx context.Context, tenantID string) (Summary, error) {
	summary := Summary{}
	err := s.db.QueryRowContext(ctx, `
		SELECT
			(SELECT COUNT(*)::int FROM outlets WHERE tenant_id = $1 AND status <> 'archived'),
			(SELECT COUNT(*)::int FROM customers WHERE tenant_id = $1),
			(SELECT COUNT(*)::int FROM visits WHERE tenant_id = $1 AND visit_at >= NOW() - INTERVAL '30 days'),
			(SELECT COUNT(*)::int FROM queue_tickets WHERE tenant_id = $1 AND status = 'waiting'),
			(SELECT COUNT(*)::int FROM barbers WHERE tenant_id = $1 AND status = 'active'),
			(SELECT COUNT(*)::int FROM stations WHERE tenant_id = $1 AND status = 'active'),
			COALESCE(pl.max_outlets, 1),
			COALESCE(pl.max_customers, 100),
			COALESCE(pl.max_reminders_per_month, 50)
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
	`, tenantID).Scan(
		&summary.Outlets,
		&summary.Customers,
		&summary.Visits30d,
		&summary.QueueWaiting,
		&summary.Barbers,
		&summary.Stations,
		&summary.MaxOutlets,
		&summary.MaxCustomers,
		&summary.MaxRemindersMonth,
	)
	if err != nil {
		return Summary{}, fmt.Errorf("load usage summary: %w", err)
	}

	return summary, nil
}
