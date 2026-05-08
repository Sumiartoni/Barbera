package visits

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

func (s *Service) ListRecent(ctx context.Context, tenantID string, limit int) ([]Visit, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	rows, err := s.db.QueryContext(ctx, `
		SELECT
			v.id,
			v.tenant_id,
			v.customer_id,
			COALESCE(v.queue_ticket_id::text, ''),
			c.full_name,
			c.phone_number,
			v.service_name,
			COALESCE(v.barber_id::text, ''),
			COALESCE(b.full_name, v.barber_name, ''),
			COALESCE(v.station_id::text, ''),
			COALESCE(s.name, ''),
			v.amount_idr,
			v.payment_status,
			v.notes,
			v.visit_at,
			v.next_reminder_at,
			v.created_at
		FROM visits v
		INNER JOIN customers c ON c.id = v.customer_id
		LEFT JOIN barbers b ON b.id = v.barber_id
		LEFT JOIN stations s ON s.id = v.station_id
		WHERE v.tenant_id = $1
		ORDER BY v.visit_at DESC, v.created_at DESC
		LIMIT $2
	`, tenantID, limit)
	if err != nil {
		return nil, fmt.Errorf("query visits: %w", err)
	}
	defer rows.Close()

	records := make([]Visit, 0, limit)
	for rows.Next() {
		record, err := scanVisit(rows)
		if err != nil {
			return nil, err
		}
		records = append(records, record)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate visits: %w", err)
	}

	return records, nil
}

func (s *Service) Create(ctx context.Context, tenantID string, actorUserID string, input CreateInput) (Visit, error) {
	customerID := strings.TrimSpace(input.CustomerID)
	queueTicketID := strings.TrimSpace(input.QueueTicketID)
	serviceName := strings.TrimSpace(input.ServiceName)
	barberID := strings.TrimSpace(input.BarberID)
	barberName := strings.TrimSpace(input.BarberName)
	stationID := strings.TrimSpace(input.StationID)
	paymentStatus := strings.TrimSpace(strings.ToLower(input.PaymentStatus))
	notes := strings.TrimSpace(input.Notes)

	if paymentStatus == "" {
		paymentStatus = "paid"
	}

	if tenantID == "" || customerID == "" || serviceName == "" || input.AmountIDR < 0 {
		return Visit{}, ErrValidation
	}

	if paymentStatus != "paid" && paymentStatus != "unpaid" {
		return Visit{}, ErrValidation
	}

	visitAt := time.Now().UTC()
	if input.VisitAt != nil && !input.VisitAt.IsZero() {
		visitAt = input.VisitAt.UTC()
	}

	var nextReminderAt *time.Time
	if input.ReminderDays > 0 {
		value := visitAt.Add(time.Duration(input.ReminderDays) * 24 * time.Hour)
		nextReminderAt = &value
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return Visit{}, fmt.Errorf("begin visit tx: %w", err)
	}
	defer tx.Rollback()

	var (
		customerName  string
		customerPhone string
	)
	err = tx.QueryRowContext(ctx, `
		SELECT full_name, phone_number
		FROM customers
		WHERE tenant_id = $1 AND id = $2
		LIMIT 1
	`, tenantID, customerID).Scan(&customerName, &customerPhone)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Visit{}, ErrCustomerGone
		}
		return Visit{}, fmt.Errorf("load customer for visit: %w", err)
	}

	if barberID != "" {
		err = tx.QueryRowContext(ctx, `
			SELECT full_name
			FROM barbers
			WHERE tenant_id = $1 AND id = $2 AND status = 'active'
			LIMIT 1
		`, tenantID, barberID).Scan(&barberName)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return Visit{}, ErrValidation
			}
			return Visit{}, fmt.Errorf("load barber for visit: %w", err)
		}
	}

	var stationName string
	if stationID != "" {
		err = tx.QueryRowContext(ctx, `
			SELECT name
			FROM stations
			WHERE tenant_id = $1 AND id = $2 AND status = 'active'
			LIMIT 1
		`, tenantID, stationID).Scan(&stationName)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return Visit{}, ErrValidation
			}
			return Visit{}, fmt.Errorf("load station for visit: %w", err)
		}
	}

	if queueTicketID != "" {
		var (
			queueCustomerID string
			queueStatus     string
		)
		err = tx.QueryRowContext(ctx, `
			SELECT customer_id::text, status
			FROM queue_tickets
			WHERE tenant_id = $1 AND id = $2
			LIMIT 1
		`, tenantID, queueTicketID).Scan(&queueCustomerID, &queueStatus)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return Visit{}, ErrValidation
			}
			return Visit{}, fmt.Errorf("load queue ticket for visit: %w", err)
		}
		if queueCustomerID != customerID {
			return Visit{}, ErrValidation
		}
		if queueStatus == "done" || queueStatus == "canceled" {
			return Visit{}, ErrValidation
		}
	}

	record := Visit{}
	var reminderValue any
	if nextReminderAt != nil {
		reminderValue = *nextReminderAt
	}
	err = tx.QueryRowContext(ctx, `
		INSERT INTO visits (
			tenant_id,
			customer_id,
			queue_ticket_id,
			service_name,
			barber_id,
			barber_name,
			station_id,
			amount_idr,
			payment_status,
			notes,
			visit_at,
			next_reminder_at,
			created_by_user_id
		)
		VALUES ($1, $2, NULLIF($3, '')::uuid, $4, NULLIF($5, '')::uuid, $6, NULLIF($7, '')::uuid, $8, $9, $10, $11, $12, $13)
		RETURNING
			id,
			tenant_id,
			customer_id,
			COALESCE(queue_ticket_id::text, ''),
			COALESCE(barber_id::text, ''),
			service_name,
			barber_name,
			COALESCE(station_id::text, ''),
			amount_idr,
			payment_status,
			notes,
			visit_at,
			next_reminder_at,
			created_at
	`, tenantID, customerID, queueTicketID, serviceName, barberID, barberName, stationID, input.AmountIDR, paymentStatus, notes, visitAt, reminderValue, nullableUUID(actorUserID)).Scan(
		&record.ID,
		&record.TenantID,
		&record.CustomerID,
		&record.QueueTicketID,
		&record.BarberID,
		&record.ServiceName,
		&record.BarberName,
		&record.StationID,
		&record.AmountIDR,
		&record.PaymentStatus,
		&record.Notes,
		&record.VisitAt,
		nullTime(&record.NextReminderAt),
		&record.CreatedAt,
	)
	if err != nil {
		return Visit{}, fmt.Errorf("insert visit: %w", err)
	}

	spentToAdd := input.AmountIDR
	if paymentStatus != "paid" {
		spentToAdd = 0
	}

	if _, err := tx.ExecContext(ctx, `
		UPDATE customers
		SET
			last_visit_at = CASE
				WHEN last_visit_at IS NULL OR last_visit_at < $3 THEN $3
				ELSE last_visit_at
			END,
			total_visits = total_visits + 1,
			total_spent_idr = total_spent_idr + $4,
			updated_at = NOW()
		WHERE tenant_id = $1 AND id = $2
	`, tenantID, customerID, visitAt, spentToAdd); err != nil {
		return Visit{}, fmt.Errorf("update customer stats: %w", err)
	}

	if queueTicketID != "" {
		if _, err := tx.ExecContext(ctx, `
			UPDATE queue_tickets
			SET
				status = 'done',
				assigned_barber_id = COALESCE(NULLIF($3, '')::uuid, assigned_barber_id),
				station_id = COALESCE(NULLIF($4, '')::uuid, station_id),
				started_at = COALESCE(started_at, $5),
				finished_at = COALESCE(finished_at, $5),
				updated_at = NOW()
			WHERE tenant_id = $1 AND id = $2
		`, tenantID, queueTicketID, barberID, stationID, visitAt); err != nil {
			return Visit{}, fmt.Errorf("update queue ticket from pos visit: %w", err)
		}

		if _, err := tx.ExecContext(ctx, `
			INSERT INTO audit_logs (tenant_id, actor_user_id, action, target_type, target_id, metadata)
			VALUES (
				$1,
				NULLIF($2, '')::uuid,
				'queue.completed_via_pos',
				'queue_ticket',
				$3,
				jsonb_build_object(
					'visit_id', $4::text,
					'customer_id', $5::text,
					'service_name', $6::text
				)
			)
		`, tenantID, actorUserID, queueTicketID, record.ID, customerID, serviceName); err != nil {
			return Visit{}, fmt.Errorf("insert queue completion audit log: %w", err)
		}
	}

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO audit_logs (tenant_id, actor_user_id, action, target_type, target_id, metadata)
		VALUES (
			$1,
			NULLIF($2, '')::uuid,
			'visit.created',
			'visit',
			$3,
			jsonb_build_object(
				'customer_id', $4::text,
				'payment_status', $5::text,
				'amount_idr', $6::bigint,
				'queue_ticket_id', NULLIF($7, '')::text
			)
		)
	`, tenantID, actorUserID, record.ID, customerID, paymentStatus, input.AmountIDR, queueTicketID); err != nil {
		return Visit{}, fmt.Errorf("insert visit audit log: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return Visit{}, fmt.Errorf("commit visit tx: %w", err)
	}

	record.CustomerName = customerName
	record.PhoneNumber = customerPhone
	record.StationName = stationName

	return record, nil
}

func nullableUUID(value string) any {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}

	return trimmed
}

type visitScanner interface {
	Scan(dest ...any) error
}

func scanVisit(scanner visitScanner) (Visit, error) {
	var (
		record         Visit
		nextReminderAt sql.NullTime
	)

	err := scanner.Scan(
		&record.ID,
		&record.TenantID,
		&record.CustomerID,
		&record.QueueTicketID,
		&record.CustomerName,
		&record.PhoneNumber,
		&record.ServiceName,
		&record.BarberID,
		&record.BarberName,
		&record.StationID,
		&record.StationName,
		&record.AmountIDR,
		&record.PaymentStatus,
		&record.Notes,
		&record.VisitAt,
		&nextReminderAt,
		&record.CreatedAt,
	)
	if err != nil {
		return Visit{}, fmt.Errorf("scan visit: %w", err)
	}

	if nextReminderAt.Valid {
		value := nextReminderAt.Time.UTC()
		record.NextReminderAt = &value
	}

	return record, nil
}

func nullTime(target **time.Time) any {
	return &sqlNullTimeTarget{target: target}
}

type sqlNullTimeTarget struct {
	target **time.Time
}

func (n *sqlNullTimeTarget) Scan(value any) error {
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
