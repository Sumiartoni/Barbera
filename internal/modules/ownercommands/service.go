package ownercommands

import (
	"context"
	"fmt"
	"strings"
	"time"

	"balikcukur/internal/modules/barbers"
	"balikcukur/internal/modules/customers"
	"balikcukur/internal/modules/queue"
	"balikcukur/internal/modules/shifts"
)

const helpMessage = "Format WA owner: HELP, SHIFT HELP, SHIFT LIST [YYYY-MM-DD], SHIFT ADD|Nama Barber|YYYY-MM-DD|09:00|17:00, SHIFT OFF|Nama Barber|YYYY-MM-DD, BARBER LIST, QUEUE STATUS, QUEUE LINK, CUSTOMER FIND|kata kunci"

type Service struct {
	barbers   *barbers.Service
	customers *customers.Service
	queue     *queue.Service
	shifts    *shifts.Service
}

func NewService(
	barbersService *barbers.Service,
	customersService *customers.Service,
	queueService *queue.Service,
	shiftsService *shifts.Service,
) *Service {
	return &Service{
		barbers:   barbersService,
		customers: customersService,
		queue:     queueService,
		shifts:    shiftsService,
	}
}

func (s *Service) Execute(ctx context.Context, tenantID string, input ExecuteInput) (Result, error) {
	if tenantID == "" || strings.TrimSpace(input.Command) == "" {
		return Result{}, ErrValidation
	}
	if !canManageShifts(input.ActorRole) {
		return Result{}, ErrForbidden
	}

	command := strings.TrimSpace(input.Command)
	upper := strings.ToUpper(command)
	switch {
	case upper == "HELP" || upper == "WA HELP" || upper == "SHIFT" || upper == "SHIFT HELP":
		return Result{
			Action:         "help",
			Message:        helpMessage,
			Output:         helpMessage,
			CommandPreview: command,
		}, nil
	case strings.HasPrefix(upper, "SHIFT LIST"):
		return s.handleList(ctx, tenantID, command)
	case strings.HasPrefix(upper, "SHIFT ADD|"):
		return s.handleAdd(ctx, tenantID, input, command)
	case strings.HasPrefix(upper, "SHIFT OFF|"):
		return s.handleOff(ctx, tenantID, command)
	case upper == "BARBER LIST":
		return s.handleBarberList(ctx, tenantID, command)
	case upper == "QUEUE STATUS":
		return s.handleQueueStatus(ctx, tenantID, command)
	case upper == "QUEUE LINK":
		return s.handleQueueLink(ctx, tenantID, command)
	case strings.HasPrefix(upper, "CUSTOMER FIND|"):
		return s.handleCustomerFind(ctx, tenantID, command)
	default:
		return Result{
			Action:         "unknown",
			Message:        "Perintah owner tidak dikenali. " + helpMessage,
			Output:         "Perintah owner tidak dikenali.\n" + helpMessage,
			CommandPreview: command,
		}, nil
	}
}

func (s *Service) handleList(ctx context.Context, tenantID string, command string) (Result, error) {
	parts := strings.Fields(command)
	day := localDayStart(time.Now().In(jakartaLocation()))
	if len(parts) >= 3 {
		parsedDay, err := parseLocalDay(parts[2])
		if err != nil {
			return Result{}, ErrValidation
		}
		day = parsedDay
	}

	records, err := s.shifts.List(ctx, tenantID, day)
	if err != nil {
		return Result{}, fmt.Errorf("list shifts command: %w", err)
	}

	lines := []string{fmt.Sprintf("Ada %d shift pada %s.", len(records), day.Format("2006-01-02"))}
	if len(records) == 0 {
		lines = append(lines, "Belum ada barber yang dijadwalkan.")
	}
	for _, record := range records {
		lines = append(lines, fmt.Sprintf("- %s %s-%s (%s)", record.BarberName, record.StartsAt.In(jakartaLocation()).Format("15:04"), record.EndsAt.In(jakartaLocation()).Format("15:04"), record.Status))
	}

	return Result{
		Action:         "list",
		Message:        lines[0],
		Output:         strings.Join(lines, "\n"),
		CommandPreview: command,
		Day:            day.Format("2006-01-02"),
		Shifts:         records,
	}, nil
}

func (s *Service) handleAdd(ctx context.Context, tenantID string, input ExecuteInput, command string) (Result, error) {
	fields := splitCommandFields(command)
	if len(fields) != 4 {
		return Result{}, ErrValidation
	}

	barber, err := s.barbers.FindByName(ctx, tenantID, fields[0])
	if err != nil {
		return Result{}, fmt.Errorf("find barber in shift command: %w", err)
	}

	startsAt, endsAt, err := parseShiftWindow(fields[1], fields[2], fields[3])
	if err != nil {
		return Result{}, ErrValidation
	}

	record, err := s.shifts.Create(ctx, tenantID, shifts.CreateInput{
		BarberID:        barber.ID,
		StartsAt:        startsAt,
		EndsAt:          endsAt,
		Notes:           ownerNote(input.ActorFullName),
		Source:          "whatsapp",
		CreatedByUserID: input.ActorUserID,
	})
	if err != nil {
		return Result{}, fmt.Errorf("create shift command: %w", err)
	}

	output := fmt.Sprintf("Shift %s berhasil dibuat untuk %s %s-%s.", barber.FullName, fields[1], fields[2], fields[3])
	return Result{
		Action:         "add",
		Message:        output,
		Output:         output,
		CommandPreview: command,
		Day:            fields[1],
		CreatedShift:   &record,
	}, nil
}

func (s *Service) handleOff(ctx context.Context, tenantID string, command string) (Result, error) {
	fields := splitCommandFields(command)
	if len(fields) != 2 {
		return Result{}, ErrValidation
	}

	barber, err := s.barbers.FindByName(ctx, tenantID, fields[0])
	if err != nil {
		return Result{}, fmt.Errorf("find barber in shift off command: %w", err)
	}

	day, err := parseLocalDay(fields[1])
	if err != nil {
		return Result{}, ErrValidation
	}

	affected, err := s.shifts.CancelByBarberAndDay(ctx, tenantID, barber.ID, day)
	if err != nil {
		return Result{}, fmt.Errorf("cancel shift command: %w", err)
	}

	output := fmt.Sprintf("Ada %d shift milik %s yang dibatalkan pada %s.", affected, barber.FullName, day.Format("2006-01-02"))
	return Result{
		Action:         "off",
		Message:        output,
		Output:         output,
		CommandPreview: command,
		Day:            day.Format("2006-01-02"),
		CanceledCount:  affected,
	}, nil
}

func (s *Service) handleBarberList(ctx context.Context, tenantID string, command string) (Result, error) {
	items, err := s.barbers.List(ctx, tenantID, barbers.ListOptions{})
	if err != nil {
		return Result{}, fmt.Errorf("list barbers command: %w", err)
	}

	names := make([]string, 0, len(items))
	lines := []string{fmt.Sprintf("Ada %d barber terdaftar.", len(items))}
	for _, item := range items {
		shiftStatus := "off"
		if item.OnShift {
			shiftStatus = "on shift"
		}
		names = append(names, item.FullName)
		lines = append(lines, fmt.Sprintf("- %s (%s, %s)", item.FullName, item.Status, shiftStatus))
	}

	return Result{
		Action:         "barber_list",
		Message:        lines[0],
		Output:         strings.Join(lines, "\n"),
		CommandPreview: command,
		Barbers:        names,
	}, nil
}

func (s *Service) handleQueueStatus(ctx context.Context, tenantID string, command string) (Result, error) {
	tickets, err := s.queue.ListActive(ctx, tenantID)
	if err != nil {
		return Result{}, fmt.Errorf("queue status command: %w", err)
	}

	waiting := 0
	serving := 0
	lines := []string{}
	for _, ticket := range tickets {
		switch ticket.Status {
		case "waiting", "assigned":
			waiting++
		case "in_service":
			serving++
		}
	}
	lines = append(lines, fmt.Sprintf("Antrian aktif: %d menunggu, %d sedang dilayani.", waiting, serving))
	for _, ticket := range tickets {
		if len(lines) >= 6 {
			break
		}
		lines = append(lines, fmt.Sprintf("- #%02d %s (%s)", ticket.QueueNumber, ticket.CustomerName, ticket.Status))
	}

	return Result{
		Action:         "queue_status",
		Message:        lines[0],
		Output:         strings.Join(lines, "\n"),
		CommandPreview: command,
		QueueWaiting:   waiting,
		QueueServing:   serving,
	}, nil
}

func (s *Service) handleQueueLink(ctx context.Context, tenantID string, command string) (Result, error) {
	tenantName, publicQueueURL, err := s.queue.PublicLinkByTenantID(ctx, tenantID)
	if err != nil {
		return Result{}, fmt.Errorf("queue link command: %w", err)
	}

	output := fmt.Sprintf("Link antrean publik %s:\n%s", tenantName, publicQueueURL)
	return Result{
		Action:         "queue_link",
		Message:        "Link antrean publik siap dibagikan.",
		Output:         output,
		CommandPreview: command,
		QueueURL:       publicQueueURL,
	}, nil
}

func (s *Service) handleCustomerFind(ctx context.Context, tenantID string, command string) (Result, error) {
	fields := splitCommandFields(command)
	if len(fields) != 1 || strings.TrimSpace(fields[0]) == "" {
		return Result{}, ErrValidation
	}

	items, err := s.customers.List(ctx, tenantID, customers.ListFilters{
		Query: fields[0],
		Limit: 5,
	})
	if err != nil {
		return Result{}, fmt.Errorf("customer find command: %w", err)
	}

	lines := []string{fmt.Sprintf("Ditemukan %d pelanggan untuk kata kunci \"%s\".", len(items), fields[0])}
	matches := make([]CustomerMatch, 0, len(items))
	for _, item := range items {
		match := CustomerMatch{
			FullName:        item.FullName,
			PhoneNumber:     item.PhoneNumber,
			PreferredBarber: item.PreferredBarberName,
			TotalVisits:     item.TotalVisits,
		}
		matches = append(matches, match)
		lines = append(lines, fmt.Sprintf("- %s (%s) %d visit", item.FullName, item.PhoneNumber, item.TotalVisits))
	}

	return Result{
		Action:         "customer_find",
		Message:        lines[0],
		Output:         strings.Join(lines, "\n"),
		CommandPreview: command,
		Customers:      matches,
	}, nil
}

func splitCommandFields(command string) []string {
	parts := strings.Split(strings.TrimSpace(command), "|")
	if len(parts) <= 1 {
		return nil
	}

	result := make([]string, 0, len(parts)-1)
	for _, item := range parts[1:] {
		result = append(result, strings.TrimSpace(item))
	}
	return result
}

func parseLocalDay(raw string) (time.Time, error) {
	location := jakartaLocation()
	parsed, err := time.ParseInLocation("2006-01-02", strings.TrimSpace(raw), location)
	if err != nil {
		return time.Time{}, err
	}
	return localDayStart(parsed), nil
}

func parseShiftWindow(day string, start string, end string) (time.Time, time.Time, error) {
	location := jakartaLocation()
	startsAt, err := time.ParseInLocation("2006-01-02 15:04", strings.TrimSpace(day)+" "+strings.TrimSpace(start), location)
	if err != nil {
		return time.Time{}, time.Time{}, err
	}
	endsAt, err := time.ParseInLocation("2006-01-02 15:04", strings.TrimSpace(day)+" "+strings.TrimSpace(end), location)
	if err != nil {
		return time.Time{}, time.Time{}, err
	}
	if !endsAt.After(startsAt) {
		return time.Time{}, time.Time{}, ErrValidation
	}
	return startsAt.UTC(), endsAt.UTC(), nil
}

func localDayStart(value time.Time) time.Time {
	return time.Date(value.Year(), value.Month(), value.Day(), 0, 0, 0, 0, value.Location())
}

func jakartaLocation() *time.Location {
	location, err := time.LoadLocation("Asia/Jakarta")
	if err != nil {
		return time.FixedZone("WIB", 7*60*60)
	}
	return location
}

func canManageShifts(role string) bool {
	switch strings.ToLower(strings.TrimSpace(role)) {
	case "owner", "admin":
		return true
	default:
		return false
	}
}

func ownerNote(actorFullName string) string {
	name := strings.TrimSpace(actorFullName)
	if name == "" {
		return "Dibuat via perintah owner"
	}
	return "Dibuat via perintah owner oleh " + name
}
