package whatsapp

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strings"

	"balikcukur/internal/modules/barbers"
	"balikcukur/internal/modules/ownercommands"
	"balikcukur/internal/modules/queue"
)

type ownerCommandExecutor interface {
	Execute(ctx context.Context, tenantID string, input ownercommands.ExecuteInput) (ownercommands.Result, error)
}

type inboundOwnerMessageHandler interface {
	HandleIncomingOwnerMessage(ctx context.Context, tenantID string, input IncomingOwnerMessageInput) (IncomingOwnerMessageResult, error)
}

type barberLister interface {
	List(ctx context.Context, tenantID string, options barbers.ListOptions) ([]barbers.Barber, error)
}

type queueManager interface {
	Create(ctx context.Context, tenantID string, input queue.CreateInput) (queue.Ticket, error)
	PublicLinkByTenantID(ctx context.Context, tenantID string) (string, string, error)
}

type Service struct {
	db       *sql.DB
	commands ownerCommandExecutor
	sessions *SessionManager
	barbers  barberLister
	queue    queueManager
}

var ErrForwarderUnauthorized = errors.New("secret webhook owner tidak valid")

func NewService(db *sql.DB, logger *slog.Logger, commands ownerCommandExecutor, barbersService barberLister, queueService queueManager) *Service {
	service := &Service{
		db:       db,
		commands: commands,
		barbers:  barbersService,
		queue:    queueService,
	}
	service.sessions = NewSessionManager(db, logger, service)
	return service
}

func (s *Service) Overview(ctx context.Context, tenantID string) (Overview, error) {
	config, err := s.GetConfig(ctx, tenantID)
	if err != nil {
		return Overview{}, err
	}
	logs, err := s.ListLogs(ctx, tenantID, 12)
	if err != nil {
		return Overview{}, err
	}
	session, err := s.sessions.State(ctx, tenantID)
	if err != nil {
		return Overview{}, err
	}
	return Overview{
		Config:  config,
		Session: session,
		CommandCatalog: []string{
			"HELP",
			"WHATSAPP STATUS",
			"SHIFT LIST 2026-04-06",
			"SHIFT ADD|Raka|2026-04-06|10:00|18:00",
			"SHIFT OFF|Raka|2026-04-06",
			"BARBER LIST",
			"QUEUE STATUS",
			"QUEUE LINK",
			"CUSTOMER FIND|andi",
			"CONFIG SHOW|settings",
			"CONFIG SET|settings|opening_hours|10:00 - 21:00",
		},
		RecentLogs: logs,
	}, nil
}

func (s *Service) GetConfig(ctx context.Context, tenantID string) (Config, error) {
	if strings.TrimSpace(tenantID) == "" {
		return Config{}, fmt.Errorf("tenant id wajib diisi")
	}

	var raw []byte
	err := s.db.QueryRowContext(ctx, `
		INSERT INTO tenant_configurations (tenant_id)
		VALUES ($1)
		ON CONFLICT (tenant_id) DO NOTHING
		RETURNING whatsapp
	`, tenantID).Scan(&raw)
	if err != nil {
		if err == sql.ErrNoRows {
			err = s.db.QueryRowContext(ctx, `
				SELECT whatsapp
				FROM tenant_configurations
				WHERE tenant_id = $1
			`, tenantID).Scan(&raw)
		}
	}
	if err != nil {
		return Config{}, fmt.Errorf("load whatsapp config: %w", err)
	}

	config := Config{}
	if len(raw) > 0 {
		if err := json.Unmarshal(raw, &config); err != nil {
			return Config{}, fmt.Errorf("parse whatsapp config: %w", err)
		}
	}
	if config.DefaultQueueMessage == "" {
		config.DefaultQueueMessage = "Halo, berikut link antrean live barbershop Anda: {{queue_link}}"
	}
	if config.DefaultReminderFooter == "" {
		config.DefaultReminderFooter = "Kirim HELP dari chat Message Yourself untuk daftar command owner."
	}

	return config, nil
}

func (s *Service) PutConfig(ctx context.Context, tenantID string, config Config) (Config, error) {
	if strings.TrimSpace(tenantID) == "" {
		return Config{}, fmt.Errorf("tenant id wajib diisi")
	}

	raw, err := json.Marshal(config)
	if err != nil {
		return Config{}, fmt.Errorf("marshal whatsapp config: %w", err)
	}

	if err := s.db.QueryRowContext(ctx, `
		INSERT INTO tenant_configurations (tenant_id, whatsapp, updated_at)
		VALUES ($1, $2::jsonb, NOW())
		ON CONFLICT (tenant_id)
		DO UPDATE SET whatsapp = EXCLUDED.whatsapp, updated_at = NOW()
		RETURNING whatsapp
	`, tenantID, raw).Scan(&raw); err != nil {
		return Config{}, fmt.Errorf("save whatsapp config: %w", err)
	}

	result := Config{}
	if len(raw) > 0 {
		if err := json.Unmarshal(raw, &result); err != nil {
			return Config{}, fmt.Errorf("parse saved whatsapp config: %w", err)
		}
	}
	return result, nil
}

func (s *Service) Execute(ctx context.Context, tenantID string, input ExecuteInput) (ownercommands.Result, error) {
	source := strings.TrimSpace(strings.ToLower(input.Source))
	if source == "" {
		source = "dashboard"
	}

	result, err := s.executeCommand(ctx, tenantID, input)
	status := "success"
	outputText := result.Output
	if outputText == "" {
		outputText = result.Message
	}
	if err != nil {
		status = "error"
		outputText = err.Error()
	}

	if insertErr := s.insertLog(ctx, tenantID, input.ActorUserID, input.ActorRole, input.Command, result.Action, status, source, outputText); insertErr != nil && err == nil {
		err = insertErr
	}

	return result, err
}

func (s *Service) ExecuteFromForwarder(ctx context.Context, publicQueueID string, input ForwarderInput) (ownercommands.Result, error) {
	publicQueueID = strings.TrimSpace(publicQueueID)
	if publicQueueID == "" || strings.TrimSpace(input.Command) == "" {
		return ownercommands.Result{}, fmt.Errorf("public queue id dan command wajib diisi")
	}

	var (
		tenantID string
		config   Config
	)
	err := s.db.QueryRowContext(ctx, `
		SELECT t.id, tc.whatsapp
		FROM tenants t
		LEFT JOIN tenant_configurations tc ON tc.tenant_id = t.id
		WHERE t.public_queue_id = $1
		  AND t.status = 'active'
		LIMIT 1
	`, publicQueueID).Scan(&tenantID, jsonRawBytes{target: &config})
	if err != nil {
		return ownercommands.Result{}, fmt.Errorf("tenant owner command tidak ditemukan")
	}

	if !config.OwnerCommandsEnabled {
		return ownercommands.Result{}, fmt.Errorf("command owner via WhatsApp belum diaktifkan")
	}

	if strings.TrimSpace(config.AndroidWebhookSecret) == "" || strings.TrimSpace(input.Secret) != strings.TrimSpace(config.AndroidWebhookSecret) {
		return ownercommands.Result{}, ErrForwarderUnauthorized
	}

	if linked := normalizePhone(config.LinkedNumber); linked != "" && normalizePhone(input.SenderNumber) != "" && linked != normalizePhone(input.SenderNumber) {
		return ownercommands.Result{}, fmt.Errorf("nomor pengirim tidak sesuai dengan nomor owner yang terhubung")
	}

	return s.Execute(ctx, tenantID, ExecuteInput{
		Command:   input.Command,
		ActorRole: "owner",
		ActorName: input.ActorName,
		Source:    "android_forwarder",
	})
}

func (s *Service) ListLogs(ctx context.Context, tenantID string, limit int) ([]CommandLog, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	rows, err := s.db.QueryContext(ctx, `
		SELECT id, command_text, action, status, source, output_text, created_at
		FROM whatsapp_command_logs
		WHERE tenant_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`, tenantID, limit)
	if err != nil {
		return nil, fmt.Errorf("list whatsapp command logs: %w", err)
	}
	defer rows.Close()

	logs := make([]CommandLog, 0, limit)
	for rows.Next() {
		var item CommandLog
		if err := rows.Scan(&item.ID, &item.CommandText, &item.Action, &item.Status, &item.Source, &item.OutputText, &item.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan whatsapp log: %w", err)
		}
		logs = append(logs, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate whatsapp logs: %w", err)
	}
	return logs, nil
}

func (s *Service) insertLog(ctx context.Context, tenantID string, actorUserID string, actorRole string, commandText string, action string, status string, source string, output string) error {
	if _, err := s.db.ExecContext(ctx, `
		INSERT INTO whatsapp_command_logs (
			tenant_id,
			actor_user_id,
			actor_role,
			command_text,
			action,
			status,
			source,
			output_text
		)
		VALUES ($1, NULLIF($2, '')::uuid, $3, $4, $5, $6, $7, $8)
	`, tenantID, actorUserID, strings.TrimSpace(actorRole), strings.TrimSpace(commandText), strings.TrimSpace(action), status, source, strings.TrimSpace(output)); err != nil {
		return fmt.Errorf("insert whatsapp log: %w", err)
	}
	return nil
}

func (s *Service) executeCommand(ctx context.Context, tenantID string, input ExecuteInput) (ownercommands.Result, error) {
	command := strings.TrimSpace(input.Command)
	upper := strings.ToUpper(command)

	switch {
	case upper == "WHATSAPP STATUS":
		config, err := s.GetConfig(ctx, tenantID)
		if err != nil {
			return ownercommands.Result{}, err
		}
		lines := []string{
			fmt.Sprintf("Owner commands: %s", boolLabel(config.OwnerCommandsEnabled)),
			fmt.Sprintf("Nomor owner: %s", emptyLabel(config.LinkedNumber)),
			fmt.Sprintf("Nama owner: %s", emptyLabel(config.LinkedName)),
			"Mode setup: QR scan + command dari chat Message Yourself",
		}
		return ownercommands.Result{
			Action:         "whatsapp_status",
			Message:        "Status WhatsApp owner berhasil dimuat.",
			Output:         strings.Join(lines, "\n"),
			CommandPreview: command,
		}, nil
	case strings.HasPrefix(upper, "CONFIG SHOW|"):
		return s.handleConfigShow(ctx, tenantID, command)
	case strings.HasPrefix(upper, "CONFIG SET|"):
		return s.handleConfigSet(ctx, tenantID, command)
	default:
		return s.commands.Execute(ctx, tenantID, ownercommands.ExecuteInput{
			Command:       input.Command,
			ActorRole:     input.ActorRole,
			ActorUserID:   input.ActorUserID,
			ActorFullName: input.ActorName,
		})
	}
}

func (s *Service) handleConfigShow(ctx context.Context, tenantID string, command string) (ownercommands.Result, error) {
	fields := splitPipeFields(command)
	if len(fields) != 1 {
		return ownercommands.Result{}, fmt.Errorf("format CONFIG SHOW harus: CONFIG SHOW|settings")
	}
	scope := normalizeScope(fields[0])
	config, err := s.loadScopedConfig(ctx, tenantID, scope)
	if err != nil {
		return ownercommands.Result{}, err
	}
	lines := []string{fmt.Sprintf("Konfigurasi %s:", scope)}
	if len(config) == 0 {
		lines = append(lines, "- belum diatur")
	} else {
		for key, value := range config {
			lines = append(lines, fmt.Sprintf("- %s: %v", key, value))
		}
	}
	return ownercommands.Result{
		Action:         "config_show",
		Message:        "Konfigurasi berhasil dimuat.",
		Output:         strings.Join(lines, "\n"),
		CommandPreview: command,
	}, nil
}

func (s *Service) handleConfigSet(ctx context.Context, tenantID string, command string) (ownercommands.Result, error) {
	fields := splitPipeFields(command)
	if len(fields) < 3 {
		return ownercommands.Result{}, fmt.Errorf("format CONFIG SET harus: CONFIG SET|scope|field|value")
	}
	scope := normalizeScope(fields[0])
	field := strings.TrimSpace(fields[1])
	value := strings.TrimSpace(strings.Join(fields[2:], "|"))
	if field == "" {
		return ownercommands.Result{}, fmt.Errorf("field konfigurasi wajib diisi")
	}

	config, err := s.loadScopedConfig(ctx, tenantID, scope)
	if err != nil {
		return ownercommands.Result{}, err
	}
	config[field] = value
	if _, err := s.saveScopedConfig(ctx, tenantID, scope, config); err != nil {
		return ownercommands.Result{}, err
	}
	output := fmt.Sprintf("Konfigurasi %s.%s berhasil diubah menjadi: %s", scope, field, value)
	return ownercommands.Result{
		Action:         "config_set",
		Message:        output,
		Output:         output,
		CommandPreview: command,
	}, nil
}

func (s *Service) loadScopedConfig(ctx context.Context, tenantID string, scope string) (map[string]any, error) {
	column, ok := configScopeColumn(scope)
	if !ok {
		return nil, fmt.Errorf("scope konfigurasi tidak dikenali")
	}

	var raw []byte
	err := s.db.QueryRowContext(ctx, fmt.Sprintf(`
		INSERT INTO tenant_configurations (tenant_id)
		VALUES ($1)
		ON CONFLICT (tenant_id) DO NOTHING
		RETURNING %s
	`, column), tenantID).Scan(&raw)
	if err != nil {
		if err == sql.ErrNoRows {
			err = s.db.QueryRowContext(ctx, fmt.Sprintf(`
				SELECT %s
				FROM tenant_configurations
				WHERE tenant_id = $1
			`, column), tenantID).Scan(&raw)
		}
	}
	if err != nil {
		return nil, fmt.Errorf("load config scope: %w", err)
	}

	result := map[string]any{}
	if len(raw) > 0 {
		if err := json.Unmarshal(raw, &result); err != nil {
			return nil, fmt.Errorf("parse config scope: %w", err)
		}
	}
	return result, nil
}

func (s *Service) saveScopedConfig(ctx context.Context, tenantID string, scope string, config map[string]any) (map[string]any, error) {
	column, ok := configScopeColumn(scope)
	if !ok {
		return nil, fmt.Errorf("scope konfigurasi tidak dikenali")
	}

	raw, err := json.Marshal(config)
	if err != nil {
		return nil, fmt.Errorf("marshal config scope: %w", err)
	}

	if err := s.db.QueryRowContext(ctx, fmt.Sprintf(`
		INSERT INTO tenant_configurations (tenant_id, %s, updated_at)
		VALUES ($1, $2::jsonb, NOW())
		ON CONFLICT (tenant_id)
		DO UPDATE SET %s = EXCLUDED.%s, updated_at = NOW()
		RETURNING %s
	`, column, column, column, column), tenantID, raw).Scan(&raw); err != nil {
		return nil, fmt.Errorf("save config scope: %w", err)
	}

	result := map[string]any{}
	if len(raw) > 0 {
		if err := json.Unmarshal(raw, &result); err != nil {
			return nil, fmt.Errorf("parse saved config scope: %w", err)
		}
	}
	return result, nil
}

func configScopeColumn(scope string) (string, bool) {
	switch normalizeScope(scope) {
	case "settings":
		return "settings", true
	case "integrations":
		return "integrations", true
	case "permissions":
		return "permissions", true
	case "whatsapp":
		return "whatsapp", true
	default:
		return "", false
	}
}

func normalizeScope(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func splitPipeFields(command string) []string {
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

func boolLabel(value bool) string {
	if value {
		return "aktif"
	}
	return "nonaktif"
}

func emptyLabel(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return "-"
	}
	return value
}

func normalizePhone(value string) string {
	value = strings.TrimSpace(value)
	value = strings.ReplaceAll(value, " ", "")
	value = strings.ReplaceAll(value, "-", "")
	value = strings.ReplaceAll(value, "(", "")
	value = strings.ReplaceAll(value, ")", "")
	return value
}

func looksLikeOwnerCommand(command string) bool {
	upper := strings.ToUpper(strings.TrimSpace(command))
	switch {
	case upper == "HELP",
		upper == "WA HELP",
		upper == "SHIFT",
		upper == "SHIFT HELP",
		upper == "BARBER LIST",
		upper == "QUEUE STATUS",
		upper == "QUEUE LINK",
		upper == "WHATSAPP STATUS":
		return true
	case strings.HasPrefix(upper, "SHIFT LIST"),
		strings.HasPrefix(upper, "SHIFT ADD|"),
		strings.HasPrefix(upper, "SHIFT OFF|"),
		strings.HasPrefix(upper, "CUSTOMER FIND|"),
		strings.HasPrefix(upper, "CONFIG SHOW|"),
		strings.HasPrefix(upper, "CONFIG SET|"):
		return true
	default:
		return false
	}
}

func (s *Service) HandleIncomingOwnerMessage(ctx context.Context, tenantID string, input IncomingOwnerMessageInput) (IncomingOwnerMessageResult, error) {
	command := strings.TrimSpace(input.Command)
	if command == "" {
		return IncomingOwnerMessageResult{Handled: false}, nil
	}

	config, err := s.GetConfig(ctx, tenantID)
	if err != nil {
		return IncomingOwnerMessageResult{}, err
	}

	isOwnerSender := input.IsSelfCommand
	if !isOwnerSender {
		linked := normalizeSessionPhone(config.LinkedNumber)
		sender := normalizeSessionPhone(input.SenderNumber)
		isOwnerSender = linked != "" && sender != "" && linked == sender
	}

	if isOwnerSender {
		if !config.OwnerCommandsEnabled {
			return IncomingOwnerMessageResult{Handled: false}, nil
		}
		result, execErr := s.Execute(ctx, tenantID, ExecuteInput{
			Command:   command,
			ActorRole: "owner",
			ActorName: strings.TrimSpace(input.SenderName),
			Source:    "whatsapp_live",
		})
		reply := strings.TrimSpace(result.Output)
		if reply == "" {
			reply = strings.TrimSpace(result.Message)
		}
		if execErr != nil {
			reply = strings.TrimSpace(execErr.Error())
		}
		if reply == "" {
			reply = "Command diterima, tetapi tidak ada output yang bisa ditampilkan."
		}

		return IncomingOwnerMessageResult{
			Handled:   true,
			ReplyText: reply,
		}, nil
	}

	return s.handleIncomingCustomerMessage(ctx, tenantID, config, input)
}

type jsonRawBytes struct {
	target *Config
}

func (j jsonRawBytes) Scan(value any) error {
	if value == nil {
		*j.target = Config{}
		return nil
	}
	raw, ok := value.([]byte)
	if !ok {
		return fmt.Errorf("unsupported whatsapp config type %T", value)
	}
	if len(raw) == 0 {
		*j.target = Config{}
		return nil
	}
	return json.Unmarshal(raw, j.target)
}
