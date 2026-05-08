package queue

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"
)

type Service struct {
	db        *sql.DB
	publicURL string
}

func NewService(db *sql.DB, publicURL string) *Service {
	return &Service{
		db:        db,
		publicURL: strings.TrimRight(strings.TrimSpace(publicURL), "/"),
	}
}

func (s *Service) ListActive(ctx context.Context, tenantID string) ([]Ticket, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT
			q.id,
			q.tenant_id,
			q.customer_id,
			c.full_name,
			q.queue_number,
			q.queue_date,
			q.service_summary,
			COALESCE(q.preferred_barber_id::text, ''),
			COALESCE(pb.full_name, ''),
			COALESCE(q.assigned_barber_id::text, ''),
			COALESCE(ab.full_name, ''),
			COALESCE(q.station_id::text, ''),
			COALESCE(s.name, ''),
			q.status,
			q.source,
			q.notes,
			q.requested_at,
			q.scheduled_for
		FROM queue_tickets q
		INNER JOIN customers c ON c.id = q.customer_id
		LEFT JOIN barbers pb ON pb.id = q.preferred_barber_id
		LEFT JOIN barbers ab ON ab.id = q.assigned_barber_id
		LEFT JOIN stations s ON s.id = q.station_id
		WHERE q.tenant_id = $1
		  AND q.status IN ('waiting', 'assigned', 'in_service')
		ORDER BY q.queue_date ASC, q.queue_number ASC, q.requested_at ASC
	`, tenantID)
	if err != nil {
		return nil, fmt.Errorf("query queue tickets: %w", err)
	}
	defer rows.Close()

	tickets := make([]Ticket, 0, 12)
	for rows.Next() {
		record, err := scanTicket(rows)
		if err != nil {
			return nil, err
		}
		tickets = append(tickets, record)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate queue tickets: %w", err)
	}

	s.decorateEstimatedWaits(ctx, tenantID, tickets)

	return tickets, nil
}

func (s *Service) Create(ctx context.Context, tenantID string, input CreateInput) (Ticket, error) {
	customerID := strings.TrimSpace(input.CustomerID)
	if tenantID == "" || customerID == "" {
		return Ticket{}, ErrValidation
	}

	source := strings.TrimSpace(input.Source)
	if source == "" {
		source = "walk_in"
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return Ticket{}, fmt.Errorf("begin queue tx: %w", err)
	}
	defer tx.Rollback()

	var customerName string
	err = tx.QueryRowContext(ctx, `
		SELECT full_name
		FROM customers
		WHERE tenant_id = $1 AND id = $2
		LIMIT 1
	`, tenantID, customerID).Scan(&customerName)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Ticket{}, ErrMissingRef
		}
		return Ticket{}, fmt.Errorf("load customer for queue: %w", err)
	}

	preferredBarberID := strings.TrimSpace(input.PreferredBarberID)
	assignedBarberID := strings.TrimSpace(input.AssignedBarberID)
	stationID := strings.TrimSpace(input.StationID)
	createdByUserID := strings.TrimSpace(input.CreatedByUserID)

	preferredBarberName, err := s.ensureBarber(tx, ctx, tenantID, preferredBarberID)
	if err != nil {
		if errors.Is(err, ErrMissingRef) {
			return Ticket{}, err
		}
		return Ticket{}, fmt.Errorf("check preferred barber: %w", err)
	}

	assignedBarberName, err := s.ensureBarber(tx, ctx, tenantID, assignedBarberID)
	if err != nil {
		if errors.Is(err, ErrMissingRef) {
			return Ticket{}, err
		}
		return Ticket{}, fmt.Errorf("check assigned barber: %w", err)
	}

	stationName, err := s.ensureStation(tx, ctx, tenantID, stationID)
	if err != nil {
		if errors.Is(err, ErrMissingRef) {
			return Ticket{}, err
		}
		return Ticket{}, fmt.Errorf("check station: %w", err)
	}

	queueDate := time.Now().UTC().Format("2006-01-02")
	queueNumber := 1
	if err := tx.QueryRowContext(ctx, `
		SELECT COALESCE(MAX(queue_number), 0) + 1
		FROM queue_tickets
		WHERE tenant_id = $1 AND queue_date = $2::date
	`, tenantID, queueDate).Scan(&queueNumber); err != nil {
		return Ticket{}, fmt.Errorf("compute queue number: %w", err)
	}

	record := Ticket{
		CustomerName:    customerName,
		PreferredBarber: preferredBarberName,
		AssignedBarber:  assignedBarberName,
		StationName:     stationName,
	}
	var scheduledFor any
	if input.ScheduledFor != nil && !input.ScheduledFor.IsZero() {
		scheduledFor = input.ScheduledFor.UTC()
	}

	err = tx.QueryRowContext(ctx, `
		INSERT INTO queue_tickets (
			tenant_id,
			customer_id,
			queue_number,
			queue_date,
			service_summary,
			preferred_barber_id,
			assigned_barber_id,
			station_id,
			source,
			notes,
			scheduled_for,
			created_by_user_id
		)
		VALUES (
			$1,
			$2,
			$3,
			$4::date,
			$5,
			NULLIF($6, '')::uuid,
			NULLIF($7, '')::uuid,
			NULLIF($8, '')::uuid,
			$9,
			$10,
			$11,
			NULLIF($12, '')::uuid
		)
		RETURNING
			id,
			tenant_id,
			customer_id,
			queue_number,
			queue_date,
			service_summary,
			COALESCE(preferred_barber_id::text, ''),
			COALESCE(assigned_barber_id::text, ''),
			COALESCE(station_id::text, ''),
			status,
			source,
			notes,
			requested_at,
			scheduled_for
	`, tenantID, customerID, queueNumber, queueDate, strings.TrimSpace(input.ServiceSummary), preferredBarberID, assignedBarberID, stationID, source, strings.TrimSpace(input.Notes), scheduledFor, createdByUserID).Scan(
		&record.ID,
		&record.TenantID,
		&record.CustomerID,
		&record.QueueNumber,
		&record.QueueDate,
		&record.ServiceSummary,
		&record.PreferredBarberID,
		&record.AssignedBarberID,
		&record.StationID,
		&record.Status,
		&record.Source,
		&record.Notes,
		&record.RequestedAt,
		nullTime(&record.ScheduledFor),
	)
	if err != nil {
		return Ticket{}, fmt.Errorf("insert queue ticket: %w", err)
	}

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO audit_logs (tenant_id, actor_user_id, action, target_type, target_id, metadata)
		VALUES (
			$1,
			NULLIF($2, '')::uuid,
			'queue.created',
			'queue_ticket',
			$3,
			jsonb_build_object(
				'queue_number', $4::int,
				'customer_id', $5::text,
				'service_summary', $6::text
			)
		)
	`, tenantID, createdByUserID, record.ID, queueNumber, customerID, record.ServiceSummary); err != nil {
		return Ticket{}, fmt.Errorf("insert queue audit log: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return Ticket{}, fmt.Errorf("commit queue tx: %w", err)
	}

	return record, nil
}

func (s *Service) UpdateStatus(ctx context.Context, tenantID string, ticketID string, actorUserID string, input UpdateStatusInput) (Ticket, error) {
	status := strings.TrimSpace(strings.ToLower(input.Status))
	if tenantID == "" || strings.TrimSpace(ticketID) == "" || status == "" {
		return Ticket{}, ErrValidation
	}
	if status != "assigned" && status != "in_service" && status != "done" && status != "canceled" {
		return Ticket{}, ErrValidation
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return Ticket{}, fmt.Errorf("begin queue status tx: %w", err)
	}
	defer tx.Rollback()

	var exists bool
	if err := tx.QueryRowContext(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM queue_tickets
			WHERE tenant_id = $1 AND id = $2
		)
	`, tenantID, ticketID).Scan(&exists); err != nil {
		return Ticket{}, fmt.Errorf("check queue ticket existence: %w", err)
	}
	if !exists {
		return Ticket{}, ErrMissingRef
	}

	assignedBarberID := strings.TrimSpace(input.AssignedBarberID)
	stationID := strings.TrimSpace(input.StationID)
	if _, err := s.ensureBarber(tx, ctx, tenantID, assignedBarberID); err != nil && !errors.Is(err, ErrMissingRef) {
		return Ticket{}, fmt.Errorf("validate assigned barber for status change: %w", err)
	} else if errors.Is(err, ErrMissingRef) {
		return Ticket{}, err
	}
	if _, err := s.ensureStation(tx, ctx, tenantID, stationID); err != nil && !errors.Is(err, ErrMissingRef) {
		return Ticket{}, fmt.Errorf("validate station for status change: %w", err)
	} else if errors.Is(err, ErrMissingRef) {
		return Ticket{}, err
	}

	var startedAt any
	var finishedAt any
	if status == "in_service" {
		startedAt = time.Now().UTC()
	}
	if status == "done" || status == "canceled" {
		finishedAt = time.Now().UTC()
	}

	if _, err := tx.ExecContext(ctx, `
		UPDATE queue_tickets
		SET
			status = $3,
			assigned_barber_id = COALESCE(NULLIF($4, '')::uuid, assigned_barber_id),
			station_id = COALESCE(NULLIF($5, '')::uuid, station_id),
			started_at = COALESCE($6, started_at),
			finished_at = COALESCE($7, finished_at),
			updated_at = NOW()
		WHERE tenant_id = $1 AND id = $2
	`, tenantID, ticketID, status, assignedBarberID, stationID, startedAt, finishedAt); err != nil {
		return Ticket{}, fmt.Errorf("update queue status: %w", err)
	}

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO audit_logs (tenant_id, actor_user_id, action, target_type, target_id, metadata)
		VALUES (
			$1,
			NULLIF($2, '')::uuid,
			'queue.status_updated',
			'queue_ticket',
			$3,
			jsonb_build_object(
				'status', $4::text,
				'assigned_barber_id', NULLIF($5, '')::text,
				'station_id', NULLIF($6, '')::text
			)
		)
	`, tenantID, actorUserID, ticketID, status, assignedBarberID, stationID); err != nil {
		return Ticket{}, fmt.Errorf("insert queue status audit log: %w", err)
	}

	record, err := s.getByID(ctx, tx, tenantID, ticketID)
	if err != nil {
		return Ticket{}, err
	}

	if err := tx.Commit(); err != nil {
		return Ticket{}, fmt.Errorf("commit queue status tx: %w", err)
	}

	return record, nil
}

func (s *Service) PublicView(ctx context.Context, publicQueueID string) (PublicQueueView, error) {
	if strings.TrimSpace(publicQueueID) == "" {
		return PublicQueueView{}, ErrValidation
	}

	view := PublicQueueView{}
	err := s.db.QueryRowContext(ctx, `
		SELECT
			t.id,
			t.name,
			t.public_queue_id,
			(
				SELECT COUNT(*)::int
				FROM barber_shifts bs
				WHERE bs.tenant_id = t.id
				  AND bs.status = 'scheduled'
				  AND bs.starts_at <= NOW()
				  AND bs.ends_at > NOW()
			) AS barbers_on_shift,
			(
				SELECT COUNT(*)::int
				FROM stations st
				WHERE st.tenant_id = t.id
				  AND st.status = 'active'
			) AS active_stations,
			(
				SELECT COUNT(*)::int
				FROM queue_tickets q
				WHERE q.tenant_id = t.id
				  AND q.status = 'waiting'
			) AS waiting_count,
			(
				SELECT COUNT(*)::int
				FROM queue_tickets q
				WHERE q.tenant_id = t.id
				  AND q.status = 'in_service'
			) AS in_service_count
		FROM tenants t
		WHERE t.public_queue_id = $1
		  AND t.public_queue_enabled = TRUE
		  AND t.status = 'active'
		LIMIT 1
	`, strings.TrimSpace(publicQueueID)).Scan(
		&view.TenantID,
		&view.TenantName,
		&view.PublicQueueID,
		&view.BarbersOnShift,
		&view.ActiveStations,
		&view.WaitingCount,
		&view.InServiceCount,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return PublicQueueView{}, ErrMissingRef
		}
		return PublicQueueView{}, fmt.Errorf("load public queue tenant: %w", err)
	}

	view.PublicQueueURL = s.publicQueueURL(view.PublicQueueID)
	view.UpdatedAt = time.Now().UTC()

	rows, err := s.db.QueryContext(ctx, `
		SELECT
			q.id,
			q.queue_number,
			c.full_name,
			q.service_summary,
			q.status,
			COALESCE(ab.full_name, ''),
			COALESCE(st.name, ''),
			q.requested_at,
			q.scheduled_for
		FROM queue_tickets q
		INNER JOIN customers c ON c.id = q.customer_id
		LEFT JOIN barbers ab ON ab.id = q.assigned_barber_id
		LEFT JOIN stations st ON st.id = q.station_id
		WHERE q.tenant_id = $1
		  AND q.status IN ('waiting', 'assigned', 'in_service')
		ORDER BY
			CASE WHEN q.status = 'in_service' THEN 0 ELSE 1 END,
			q.queue_date ASC,
			q.queue_number ASC
	`, view.TenantID)
	if err != nil {
		return PublicQueueView{}, fmt.Errorf("query public queue tickets: %w", err)
	}
	defer rows.Close()

	view.Tickets = make([]PublicTicket, 0, 24)
	for rows.Next() {
		var (
			record       PublicTicket
			scheduledFor sql.NullTime
		)
		if err := rows.Scan(
			&record.ID,
			&record.QueueNumber,
			&record.CustomerName,
			&record.ServiceSummary,
			&record.Status,
			&record.AssignedBarber,
			&record.StationName,
			&record.RequestedAt,
			&scheduledFor,
		); err != nil {
			return PublicQueueView{}, fmt.Errorf("scan public queue ticket: %w", err)
		}

		if scheduledFor.Valid {
			value := scheduledFor.Time.UTC()
			record.ScheduledFor = &value
		}
		view.Tickets = append(view.Tickets, record)
	}
	if err := rows.Err(); err != nil {
		return PublicQueueView{}, fmt.Errorf("iterate public queue tickets: %w", err)
	}

	tickets := make([]Ticket, 0, len(view.Tickets))
	for _, item := range view.Tickets {
		tickets = append(tickets, Ticket{
			ServiceSummary: item.ServiceSummary,
			Status:         item.Status,
		})
	}
	s.decorateEstimatedWaits(ctx, view.TenantID, tickets)
	for index := range view.Tickets {
		if index < len(tickets) {
			view.Tickets[index].EstimatedWaitMinutes = tickets[index].EstimatedWaitMinutes
		}
	}

	return view, nil
}

func (s *Service) PublicLinkByTenantID(ctx context.Context, tenantID string) (string, string, error) {
	if strings.TrimSpace(tenantID) == "" {
		return "", "", ErrValidation
	}

	var (
		tenantName    string
		publicQueueID string
		publicEnabled bool
	)
	if err := s.db.QueryRowContext(ctx, `
		SELECT name, public_queue_id, public_queue_enabled
		FROM tenants
		WHERE id = $1
		  AND status = 'active'
		LIMIT 1
	`, tenantID).Scan(&tenantName, &publicQueueID, &publicEnabled); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", "", ErrMissingRef
		}
		return "", "", fmt.Errorf("load tenant public queue link: %w", err)
	}
	if !publicEnabled || publicQueueID == "" {
		return tenantName, "", ErrMissingRef
	}

	return tenantName, s.publicQueueURL(publicQueueID), nil
}

func (s *Service) getByID(ctx context.Context, tx *sql.Tx, tenantID string, ticketID string) (Ticket, error) {
	row := tx.QueryRowContext(ctx, `
		SELECT
			q.id,
			q.tenant_id,
			q.customer_id,
			c.full_name,
			q.queue_number,
			q.queue_date,
			q.service_summary,
			COALESCE(q.preferred_barber_id::text, ''),
			COALESCE(pb.full_name, ''),
			COALESCE(q.assigned_barber_id::text, ''),
			COALESCE(ab.full_name, ''),
			COALESCE(q.station_id::text, ''),
			COALESCE(st.name, ''),
			q.status,
			q.source,
			q.notes,
			q.requested_at,
			q.scheduled_for
		FROM queue_tickets q
		INNER JOIN customers c ON c.id = q.customer_id
		LEFT JOIN barbers pb ON pb.id = q.preferred_barber_id
		LEFT JOIN barbers ab ON ab.id = q.assigned_barber_id
		LEFT JOIN stations st ON st.id = q.station_id
		WHERE q.tenant_id = $1 AND q.id = $2
		LIMIT 1
	`, tenantID, ticketID)

	record, err := scanTicket(row)
	if err != nil {
		if strings.Contains(err.Error(), sql.ErrNoRows.Error()) {
			return Ticket{}, ErrMissingRef
		}
		return Ticket{}, err
	}

	return record, nil
}

func (s *Service) ensureBarber(tx *sql.Tx, ctx context.Context, tenantID string, barberID string) (string, error) {
	barberID = strings.TrimSpace(barberID)
	if barberID == "" {
		return "", nil
	}

	var barberName string
	err := tx.QueryRowContext(ctx, `
		SELECT full_name
		FROM barbers
		WHERE tenant_id = $1 AND id = $2 AND status = 'active'
		LIMIT 1
	`, tenantID, barberID).Scan(&barberName)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", ErrMissingRef
		}
		return "", err
	}

	return barberName, nil
}

func (s *Service) ensureStation(tx *sql.Tx, ctx context.Context, tenantID string, stationID string) (string, error) {
	stationID = strings.TrimSpace(stationID)
	if stationID == "" {
		return "", nil
	}

	var stationName string
	err := tx.QueryRowContext(ctx, `
		SELECT name
		FROM stations
		WHERE tenant_id = $1 AND id = $2 AND status = 'active'
		LIMIT 1
	`, tenantID, stationID).Scan(&stationName)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", ErrMissingRef
		}
		return "", err
	}

	return stationName, nil
}

func (s *Service) publicQueueURL(publicQueueID string) string {
	if s.publicURL == "" || publicQueueID == "" {
		return ""
	}

	return s.publicURL + "/q/" + publicQueueID
}

type ticketScanner interface {
	Scan(dest ...any) error
}

func scanTicket(scanner ticketScanner) (Ticket, error) {
	var (
		record       Ticket
		queueDate    time.Time
		scheduledFor sql.NullTime
	)
	err := scanner.Scan(
		&record.ID,
		&record.TenantID,
		&record.CustomerID,
		&record.CustomerName,
		&record.QueueNumber,
		&queueDate,
		&record.ServiceSummary,
		&record.PreferredBarberID,
		&record.PreferredBarber,
		&record.AssignedBarberID,
		&record.AssignedBarber,
		&record.StationID,
		&record.StationName,
		&record.Status,
		&record.Source,
		&record.Notes,
		&record.RequestedAt,
		&scheduledFor,
	)
	if err != nil {
		return Ticket{}, fmt.Errorf("scan queue ticket: %w", err)
	}

	record.QueueDate = queueDate.Format("2006-01-02")
	if scheduledFor.Valid {
		value := scheduledFor.Time.UTC()
		record.ScheduledFor = &value
	}

	return record, nil
}

func nullTime(target **time.Time) any {
	return &sqlNullTimeTarget{target: target}
}

func (s *Service) decorateEstimatedWaits(ctx context.Context, tenantID string, tickets []Ticket) {
	if len(tickets) == 0 || strings.TrimSpace(tenantID) == "" {
		return
	}

	capacity := s.queueCapacity(ctx, tenantID)
	if capacity <= 0 {
		capacity = 1
	}
	serviceDurations := s.loadServiceDurations(ctx, tenantID)
	averageDuration := averageDurationMinutes(serviceDurations)
	if averageDuration <= 0 {
		averageDuration = 45
	}

	workloadMinutes := 0
	for index := range tickets {
		ticket := &tickets[index]
		switch ticket.Status {
		case "in_service":
			ticket.EstimatedWaitMinutes = 0
			workloadMinutes += maxDuration(averageDuration/2, 15)
		case "waiting", "assigned":
			ticket.EstimatedWaitMinutes = int(math.Ceil(float64(workloadMinutes) / float64(capacity)))
			workloadMinutes += estimateServiceDuration(ticket.ServiceSummary, serviceDurations, averageDuration)
		default:
			ticket.EstimatedWaitMinutes = 0
		}
	}
}

func (s *Service) queueCapacity(ctx context.Context, tenantID string) int {
	var (
		barbersOnShift int
		activeStations int
	)
	err := s.db.QueryRowContext(ctx, `
		SELECT
			(
				SELECT COUNT(*)::int
				FROM barber_shifts
				WHERE tenant_id = $1
				  AND status = 'scheduled'
				  AND starts_at <= NOW()
				  AND ends_at > NOW()
			),
			(
				SELECT COUNT(*)::int
				FROM stations
				WHERE tenant_id = $1
				  AND status = 'active'
			)
	`, tenantID).Scan(&barbersOnShift, &activeStations)
	if err != nil {
		return 1
	}
	if barbersOnShift <= 0 && activeStations <= 0 {
		return 1
	}
	if barbersOnShift <= 0 {
		return activeStations
	}
	if activeStations <= 0 {
		return barbersOnShift
	}
	if barbersOnShift < activeStations {
		return barbersOnShift
	}
	return activeStations
}

func (s *Service) loadServiceDurations(ctx context.Context, tenantID string) map[string]int {
	rows, err := s.db.QueryContext(ctx, `
		SELECT name, COALESCE((config->>'duration_minutes')::int, 45)
		FROM tenant_resource_items
		WHERE tenant_id = $1
		  AND resource_type = 'service'
		  AND status = 'active'
	`, tenantID)
	if err != nil {
		return map[string]int{}
	}
	defer rows.Close()

	items := make(map[string]int)
	for rows.Next() {
		var (
			name     string
			duration int
		)
		if err := rows.Scan(&name, &duration); err != nil {
			continue
		}
		items[strings.ToLower(strings.TrimSpace(name))] = duration
	}
	return items
}

func estimateServiceDuration(serviceSummary string, durations map[string]int, fallback int) int {
	name := strings.ToLower(strings.TrimSpace(serviceSummary))
	if name == "" {
		return fallback
	}
	if duration, ok := durations[name]; ok && duration > 0 {
		return duration
	}
	for key, duration := range durations {
		if strings.Contains(name, key) || strings.Contains(key, name) {
			return duration
		}
	}
	return fallback
}

func averageDurationMinutes(durations map[string]int) int {
	if len(durations) == 0 {
		return 0
	}
	total := 0
	count := 0
	for _, duration := range durations {
		if duration <= 0 {
			continue
		}
		total += duration
		count++
	}
	if count == 0 {
		return 0
	}
	return int(math.Ceil(float64(total) / float64(count)))
}

func maxDuration(left int, right int) int {
	if left > right {
		return left
	}
	return right
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
