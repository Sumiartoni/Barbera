package reports

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

func (s *Service) DashboardSummary(ctx context.Context, tenantID string) (DashboardSummary, error) {
	summary := DashboardSummary{}

	err := s.db.QueryRowContext(ctx, `
		SELECT
			COUNT(*)::int AS total_customers,
			COUNT(*) FILTER (
				WHERE last_visit_at >= NOW() - INTERVAL '30 days'
			)::int AS active_customers_30d,
			COUNT(*) FILTER (
				WHERE last_visit_at IS NULL OR last_visit_at < NOW() - INTERVAL '30 days'
			)::int AS dormant_customers_30d
		FROM customers
		WHERE tenant_id = $1
	`, tenantID).Scan(
		&summary.Stats.TotalCustomers,
		&summary.Stats.ActiveCustomers30d,
		&summary.Stats.DormantCustomers30d,
	)
	if err != nil {
		return DashboardSummary{}, fmt.Errorf("query customer stats: %w", err)
	}

	var averageTicket sql.NullFloat64
	err = s.db.QueryRowContext(ctx, `
		SELECT
			COUNT(*)::int AS visits_30d,
			COALESCE(SUM(amount_idr) FILTER (WHERE payment_status = 'paid'), 0)::bigint AS revenue_30d_idr,
			AVG(amount_idr) FILTER (WHERE payment_status = 'paid') AS average_ticket_30d_idr,
			COUNT(*) FILTER (
				WHERE next_reminder_at >= NOW() AND next_reminder_at <= NOW() + INTERVAL '7 days'
			)::int AS upcoming_reminders_7d
		FROM visits
		WHERE tenant_id = $1
		  AND visit_at >= NOW() - INTERVAL '30 days'
	`, tenantID).Scan(
		&summary.Stats.Visits30d,
		&summary.Stats.Revenue30dIDR,
		&averageTicket,
		&summary.Stats.UpcomingReminders7d,
	)
	if err != nil {
		return DashboardSummary{}, fmt.Errorf("query visit stats: %w", err)
	}
	if averageTicket.Valid {
		summary.Stats.AverageTicket30dIDR = int64(averageTicket.Float64)
	}

	err = s.db.QueryRowContext(ctx, `
		SELECT
			COUNT(*) FILTER (
				WHERE status = 'scheduled'
				  AND starts_at <= NOW()
				  AND ends_at > NOW()
			)::int AS barbers_on_shift_now,
			(
				SELECT COUNT(*)::int
				FROM queue_tickets
				WHERE tenant_id = $1
				  AND status IN ('waiting', 'assigned', 'in_service')
			) AS active_queue_tickets,
			(
				SELECT COUNT(*)::int
				FROM stations
				WHERE tenant_id = $1
				  AND status = 'active'
			) AS active_stations
		FROM barber_shifts
		WHERE tenant_id = $1
	`, tenantID).Scan(
		&summary.Stats.BarbersOnShiftNow,
		&summary.Stats.ActiveQueueTickets,
		&summary.Stats.ActiveStations,
	)
	if err != nil {
		return DashboardSummary{}, fmt.Errorf("query operation stats: %w", err)
	}

	err = s.db.QueryRowContext(ctx, `
		SELECT
			(SELECT COUNT(*)::int FROM barbers WHERE tenant_id = $1 AND status = 'active') AS barbers_count,
			(SELECT COUNT(*)::int FROM tenant_resource_items WHERE tenant_id = $1 AND resource_type = 'service' AND status = 'active') AS services_count,
			(SELECT COUNT(*)::int FROM stations WHERE tenant_id = $1 AND status = 'active') AS stations_count,
			EXISTS (SELECT 1 FROM outlets WHERE tenant_id = $1 AND is_primary = TRUE) AS primary_outlet_ready,
			EXISTS (
				SELECT 1
				FROM tenant_whatsapp_sessions
				WHERE tenant_id = $1
				  AND status = 'connected'
			) AS whatsapp_connected,
			COALESCE(
				(SELECT public_queue_enabled FROM tenants WHERE id = $1),
				FALSE
			) AS public_queue_enabled
	`, tenantID).Scan(
		&summary.Setup.BarbersCount,
		&summary.Setup.ServicesCount,
		&summary.Setup.StationsCount,
		&summary.Setup.PrimaryOutletReady,
		&summary.Setup.WhatsAppConnected,
		&summary.Setup.PublicQueueEnabled,
	)
	if err != nil {
		return DashboardSummary{}, fmt.Errorf("query dashboard setup state: %w", err)
	}

	setupChecks := 0
	if summary.Setup.PrimaryOutletReady {
		setupChecks++
	}
	if summary.Setup.ServicesCount > 0 {
		setupChecks++
	}
	if summary.Setup.BarbersCount > 0 {
		setupChecks++
	}
	if summary.Setup.StationsCount > 0 {
		setupChecks++
	}
	if summary.Setup.WhatsAppConnected {
		setupChecks++
	}
	if summary.Setup.PublicQueueEnabled {
		setupChecks++
	}
	summary.Setup.SetupReadyScore = setupChecks * 100 / 6

	customerRows, err := s.db.QueryContext(ctx, `
		SELECT
			c.id,
			c.full_name,
			c.phone_number,
			COALESCE(b.full_name, c.preferred_barber, ''),
			c.last_visit_at,
			c.total_visits
		FROM customers c
		LEFT JOIN barbers b ON b.id = c.preferred_barber_id
		WHERE c.tenant_id = $1
		ORDER BY c.created_at DESC
		LIMIT 6
	`, tenantID)
	if err != nil {
		return DashboardSummary{}, fmt.Errorf("query recent customers: %w", err)
	}
	defer customerRows.Close()

	summary.RecentCustomers = make([]DashboardCustomer, 0, 6)
	for customerRows.Next() {
		var (
			record      DashboardCustomer
			lastVisitAt sql.NullTime
		)
		if err := customerRows.Scan(
			&record.ID,
			&record.FullName,
			&record.PhoneNumber,
			&record.PreferredBarber,
			&lastVisitAt,
			&record.TotalVisits,
		); err != nil {
			return DashboardSummary{}, fmt.Errorf("scan recent customer: %w", err)
		}

		if lastVisitAt.Valid {
			value := lastVisitAt.Time.UTC()
			record.LastVisitAt = &value
		}

		summary.RecentCustomers = append(summary.RecentCustomers, record)
	}
	if err := customerRows.Err(); err != nil {
		return DashboardSummary{}, fmt.Errorf("iterate recent customers: %w", err)
	}

	visitRows, err := s.db.QueryContext(ctx, `
		SELECT
			v.id,
			v.customer_id,
			c.full_name,
			v.service_name,
			COALESCE(b.full_name, v.barber_name, ''),
			v.amount_idr,
			v.payment_status,
			v.visit_at,
			v.next_reminder_at
		FROM visits v
		INNER JOIN customers c ON c.id = v.customer_id
		LEFT JOIN barbers b ON b.id = v.barber_id
		WHERE v.tenant_id = $1
		ORDER BY v.visit_at DESC, v.created_at DESC
		LIMIT 8
	`, tenantID)
	if err != nil {
		return DashboardSummary{}, fmt.Errorf("query recent visits: %w", err)
	}
	defer visitRows.Close()

	summary.RecentVisits = make([]DashboardVisit, 0, 8)
	for visitRows.Next() {
		var (
			record         DashboardVisit
			nextReminderAt sql.NullTime
		)
		if err := visitRows.Scan(
			&record.ID,
			&record.CustomerID,
			&record.CustomerName,
			&record.ServiceName,
			&record.BarberName,
			&record.AmountIDR,
			&record.PaymentStatus,
			&record.VisitAt,
			&nextReminderAt,
		); err != nil {
			return DashboardSummary{}, fmt.Errorf("scan recent visit: %w", err)
		}

		if nextReminderAt.Valid {
			value := nextReminderAt.Time.UTC()
			record.NextReminderAt = &value
		}

		summary.RecentVisits = append(summary.RecentVisits, record)
	}
	if err := visitRows.Err(); err != nil {
		return DashboardSummary{}, fmt.Errorf("iterate recent visits: %w", err)
	}

	return summary, nil
}
