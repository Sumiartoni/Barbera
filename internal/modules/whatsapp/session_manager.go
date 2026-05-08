package whatsapp

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"go.mau.fi/whatsmeow"
	waE2E "go.mau.fi/whatsmeow/binary/proto"
	"go.mau.fi/whatsmeow/store"
	"go.mau.fi/whatsmeow/store/sqlstore"
	waTypes "go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	waLog "go.mau.fi/whatsmeow/util/log"
	"google.golang.org/protobuf/proto"
)

type SessionManager struct {
	db        *sql.DB
	logger    *slog.Logger
	container *sqlstore.Container
	handler   inboundOwnerMessageHandler

	mu       sync.RWMutex
	runtimes map[string]*tenantRuntime
	initErr  error
}

type tenantRuntime struct {
	tenantID string
	client   *whatsmeow.Client
	device   *store.Device
}

func NewSessionManager(db *sql.DB, logger *slog.Logger, handler inboundOwnerMessageHandler) *SessionManager {
	manager := &SessionManager{
		db:        db,
		logger:    logger,
		container: sqlstore.NewWithDB(db, "postgres", waLog.Stdout("barbera-wa", "ERROR", false)),
		handler:   handler,
		runtimes:  map[string]*tenantRuntime{},
	}

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	if err := manager.container.Upgrade(ctx); err != nil {
		manager.initErr = fmt.Errorf("upgrade whatsmeow sqlstore: %w", err)
		manager.logger.Error("whatsapp session manager init failed", "err", err)
		return manager
	}

	if err := manager.restoreSessions(ctx); err != nil {
		manager.logger.Error("restore whatsapp sessions failed", "err", err)
	}

	return manager
}

func (m *SessionManager) State(ctx context.Context, tenantID string) (SessionState, error) {
	if err := m.ensureReady(); err != nil {
		return SessionState{}, err
	}
	return m.loadSessionState(ctx, tenantID)
}

func (m *SessionManager) StartQRPairing(ctx context.Context, tenantID string) (SessionState, error) {
	if err := m.ensureReady(); err != nil {
		return SessionState{}, err
	}

	runtime, err := m.replaceRuntimeWithFreshDevice(ctx, tenantID)
	if err != nil {
		return SessionState{}, err
	}

	pairCtx, pairCancel := context.WithTimeout(context.Background(), 3*time.Minute)

	qrChan, err := runtime.client.GetQRChannel(pairCtx)
	if err != nil {
		pairCancel()
		_ = m.markError(ctx, tenantID, fmt.Sprintf("gagal menyiapkan QR channel: %v", err))
		return SessionState{}, fmt.Errorf("gagal menyiapkan QR channel: %w", err)
	}

	if err := runtime.client.Connect(); err != nil {
		pairCancel()
		_ = m.markError(ctx, tenantID, fmt.Sprintf("gagal connect ke WhatsApp: %v", err))
		return SessionState{}, fmt.Errorf("gagal connect ke WhatsApp: %w", err)
	}

	var firstItem whatsmeow.QRChannelItem
	select {
	case item, ok := <-qrChan:
		if !ok {
			pairCancel()
			_ = m.markError(ctx, tenantID, "channel QR WhatsApp tertutup sebelum siap")
			return SessionState{}, fmt.Errorf("channel QR WhatsApp tertutup sebelum siap")
		}
		if item.Event != whatsmeow.QRChannelEventCode || strings.TrimSpace(item.Code) == "" {
			pairCancel()
			if item.Error != nil {
				_ = m.markError(ctx, tenantID, item.Error.Error())
				return SessionState{}, item.Error
			}
			_ = m.markError(ctx, tenantID, "WhatsApp belum siap untuk QR pairing")
			return SessionState{}, fmt.Errorf("whatsapp belum siap untuk qr pairing")
		}
		firstItem = item
	case <-time.After(25 * time.Second):
		pairCancel()
		_ = m.markError(ctx, tenantID, "timeout saat menunggu QR WhatsApp")
		return SessionState{}, fmt.Errorf("timeout saat menunggu qr whatsapp")
	case <-ctx.Done():
		pairCancel()
		return SessionState{}, ctx.Err()
	}

	expiresAt := time.Now().UTC().Add(firstItem.Timeout)
	if err := m.persistPairingQR(ctx, tenantID, firstItem.Code, expiresAt); err != nil {
		return SessionState{}, err
	}

	go m.consumeQRChannel(tenantID, qrChan, pairCancel)
	return m.loadSessionState(ctx, tenantID)
}

func (m *SessionManager) PairPhone(ctx context.Context, tenantID string, phoneNumber string) (SessionState, error) {
	if err := m.ensureReady(); err != nil {
		return SessionState{}, err
	}

	phoneNumber = normalizeSessionPhone(phoneNumber)
	if phoneNumber == "" {
		return SessionState{}, fmt.Errorf("nomor WhatsApp wajib diisi")
	}

	runtime, err := m.replaceRuntimeWithFreshDevice(ctx, tenantID)
	if err != nil {
		return SessionState{}, err
	}

	pairCtx, pairCancel := context.WithTimeout(context.Background(), 3*time.Minute)

	qrChan, err := runtime.client.GetQRChannel(pairCtx)
	if err != nil {
		pairCancel()
		_ = m.markError(ctx, tenantID, fmt.Sprintf("gagal menyiapkan pairing channel: %v", err))
		return SessionState{}, fmt.Errorf("gagal menyiapkan pairing channel: %w", err)
	}

	if err := runtime.client.Connect(); err != nil {
		pairCancel()
		_ = m.markError(ctx, tenantID, fmt.Sprintf("gagal connect ke WhatsApp: %v", err))
		return SessionState{}, fmt.Errorf("gagal connect ke WhatsApp: %w", err)
	}

	select {
	case item, ok := <-qrChan:
		if !ok {
			pairCancel()
			_ = m.markError(ctx, tenantID, "channel pairing WhatsApp tertutup sebelum siap")
			return SessionState{}, fmt.Errorf("channel pairing WhatsApp tertutup sebelum siap")
		}
		if item.Event != whatsmeow.QRChannelEventCode {
			pairCancel()
			if item.Error != nil {
				_ = m.markError(ctx, tenantID, item.Error.Error())
				return SessionState{}, item.Error
			}
			_ = m.markError(ctx, tenantID, "WhatsApp belum siap untuk pairing code")
			return SessionState{}, fmt.Errorf("whatsapp belum siap untuk pairing code")
		}
	case <-time.After(25 * time.Second):
		pairCancel()
		_ = m.markError(ctx, tenantID, "timeout saat menunggu kanal pairing WhatsApp")
		return SessionState{}, fmt.Errorf("timeout saat menunggu kanal pairing WhatsApp")
	case <-ctx.Done():
		pairCancel()
		return SessionState{}, ctx.Err()
	}

	go m.consumeQRChannel(tenantID, qrChan, pairCancel)

	pairCode, err := runtime.client.PairPhone(ctx, phoneNumber, false, whatsmeow.PairClientChrome, "Chrome (Windows)")
	if err != nil {
		pairCancel()
		_ = m.markError(ctx, tenantID, fmt.Sprintf("gagal membuat pairing code: %v", err))
		return SessionState{}, fmt.Errorf("gagal membuat pairing code: %w", err)
	}

	expiresAt := time.Now().UTC().Add(3 * time.Minute)
	if _, err := m.db.ExecContext(ctx, `
		INSERT INTO tenant_whatsapp_sessions (
			tenant_id,
			status,
			session_mode,
			phone_number,
			pairing_code,
			pairing_expires_at,
			last_error,
			updated_at
		)
		VALUES ($1, 'pairing', 'pair_code', $2, $3, $4, '', NOW())
		ON CONFLICT (tenant_id)
		DO UPDATE SET
			status = 'pairing',
			session_mode = 'pair_code',
			phone_number = EXCLUDED.phone_number,
			pairing_code = EXCLUDED.pairing_code,
			pairing_expires_at = EXCLUDED.pairing_expires_at,
			last_error = '',
			updated_at = NOW()
	`, tenantID, phoneNumber, pairCode, expiresAt); err != nil {
		return SessionState{}, fmt.Errorf("simpan state pairing whatsapp: %w", err)
	}

	return m.loadSessionState(ctx, tenantID)
}

func (m *SessionManager) ConnectExisting(ctx context.Context, tenantID string) (SessionState, error) {
	if err := m.ensureReady(); err != nil {
		return SessionState{}, err
	}

	state, err := m.loadSessionState(ctx, tenantID)
	if err != nil {
		return SessionState{}, err
	}
	if strings.TrimSpace(state.DeviceJID) == "" {
		return SessionState{}, fmt.Errorf("belum ada device WhatsApp yang pernah dihubungkan")
	}

	runtime, err := m.runtimeFromStoredDevice(ctx, tenantID, state.DeviceJID)
	if err != nil {
		return SessionState{}, err
	}
	if !runtime.client.IsConnected() {
		if err := runtime.client.Connect(); err != nil {
			_ = m.markError(ctx, tenantID, fmt.Sprintf("gagal reconnect ke WhatsApp: %v", err))
			return SessionState{}, fmt.Errorf("gagal reconnect ke WhatsApp: %w", err)
		}
	}

	return m.loadSessionState(ctx, tenantID)
}

func (m *SessionManager) Disconnect(ctx context.Context, tenantID string) (SessionState, error) {
	if err := m.ensureReady(); err != nil {
		return SessionState{}, err
	}

	runtime := m.runtime(tenantID)
	if runtime != nil {
		runtime.client.Disconnect()
	}

	if _, err := m.db.ExecContext(ctx, `
		INSERT INTO tenant_whatsapp_sessions (tenant_id, status, updated_at)
		VALUES ($1, 'disconnected', NOW())
		ON CONFLICT (tenant_id)
		DO UPDATE SET
			status = 'disconnected',
			pairing_code = '',
			pairing_expires_at = NULL,
			metadata = COALESCE(tenant_whatsapp_sessions.metadata, '{}'::jsonb) - 'pairing_qr',
			last_error = '',
			updated_at = NOW()
	`, tenantID); err != nil {
		return SessionState{}, fmt.Errorf("update whatsapp disconnect state: %w", err)
	}

	return m.loadSessionState(ctx, tenantID)
}

func (m *SessionManager) SendTestMessage(ctx context.Context, tenantID string, phoneNumber string, message string) (SessionState, error) {
	if err := m.ensureReady(); err != nil {
		return SessionState{}, err
	}

	phoneNumber = normalizeSessionPhone(phoneNumber)
	if phoneNumber == "" {
		return SessionState{}, fmt.Errorf("nomor tujuan wajib diisi")
	}
	message = strings.TrimSpace(message)
	if message == "" {
		message = "Tes koneksi WhatsApp BARBERA berhasil."
	}

	runtime := m.runtime(tenantID)
	if runtime == nil || !runtime.client.IsConnected() || !runtime.client.IsLoggedIn() {
		var err error
		runtime, err = m.ensureConnectedRuntime(ctx, tenantID)
		if err != nil {
			return SessionState{}, err
		}
	}

	targetJID := waTypes.NewJID(phoneNumber, waTypes.DefaultUserServer)
	if _, err := runtime.client.SendMessage(ctx, targetJID, &waE2E.Message{
		Conversation: proto.String(message),
	}); err != nil {
		_ = m.markError(ctx, tenantID, fmt.Sprintf("gagal kirim pesan uji: %v", err))
		return SessionState{}, fmt.Errorf("gagal kirim pesan uji: %w", err)
	}

	if _, err := m.db.ExecContext(ctx, `
		UPDATE tenant_whatsapp_sessions
		SET last_message_at = NOW(),
			last_error = '',
			updated_at = NOW()
		WHERE tenant_id = $1
	`, tenantID); err != nil {
		return SessionState{}, fmt.Errorf("update last message whatsapp: %w", err)
	}

	return m.loadSessionState(ctx, tenantID)
}

func (m *SessionManager) restoreSessions(ctx context.Context) error {
	rows, err := m.db.QueryContext(ctx, `
		SELECT tenant_id, device_jid
		FROM tenant_whatsapp_sessions
		WHERE device_jid <> ''
		  AND status IN ('connected', 'disconnected', 'pairing')
	`)
	if err != nil {
		return fmt.Errorf("query stored whatsapp sessions: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var tenantID string
		var deviceJID string
		if err := rows.Scan(&tenantID, &deviceJID); err != nil {
			return fmt.Errorf("scan stored whatsapp session: %w", err)
		}
		runtime, err := m.runtimeFromStoredDevice(ctx, tenantID, deviceJID)
		if err != nil {
			m.logger.Error("restore whatsapp runtime failed", "tenant_id", tenantID, "err", err)
			continue
		}
		go func(rt *tenantRuntime) {
			connectCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			if !rt.client.IsConnected() {
				if err := rt.client.Connect(); err != nil {
					_ = m.markError(connectCtx, rt.tenantID, fmt.Sprintf("gagal restore session WhatsApp: %v", err))
				}
			}
		}(runtime)
	}

	return rows.Err()
}

func (m *SessionManager) ensureConnectedRuntime(ctx context.Context, tenantID string) (*tenantRuntime, error) {
	state, err := m.loadSessionState(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(state.DeviceJID) == "" {
		return nil, fmt.Errorf("session WhatsApp tenant belum pernah dihubungkan")
	}
	runtime, err := m.runtimeFromStoredDevice(ctx, tenantID, state.DeviceJID)
	if err != nil {
		return nil, err
	}
	if !runtime.client.IsConnected() {
		if err := runtime.client.Connect(); err != nil {
			return nil, fmt.Errorf("gagal connect ke session WhatsApp tenant: %w", err)
		}
	}
	if !runtime.client.IsLoggedIn() {
		return nil, fmt.Errorf("session WhatsApp belum login penuh, tunggu beberapa detik lalu coba lagi")
	}
	return runtime, nil
}

func (m *SessionManager) runtimeFromStoredDevice(ctx context.Context, tenantID string, deviceJID string) (*tenantRuntime, error) {
	if runtime := m.runtime(tenantID); runtime != nil {
		return runtime, nil
	}

	parsedJID, err := waTypes.ParseJID(deviceJID)
	if err != nil {
		return nil, fmt.Errorf("parse device jid: %w", err)
	}
	device, err := m.container.GetDevice(ctx, parsedJID)
	if err != nil {
		return nil, fmt.Errorf("load device store whatsapp: %w", err)
	}

	runtime := m.newRuntime(tenantID, device)
	m.mu.Lock()
	m.runtimes[tenantID] = runtime
	m.mu.Unlock()
	return runtime, nil
}

func (m *SessionManager) replaceRuntimeWithFreshDevice(ctx context.Context, tenantID string) (*tenantRuntime, error) {
	if _, err := m.db.ExecContext(ctx, `
		INSERT INTO tenant_whatsapp_sessions (tenant_id, status, session_mode, updated_at)
		VALUES ($1, 'disconnected', 'qr_code', NOW())
		ON CONFLICT (tenant_id)
		DO UPDATE SET session_mode = 'qr_code', updated_at = NOW()
	`, tenantID); err != nil {
		return nil, fmt.Errorf("ensure whatsapp tenant session row: %w", err)
	}

	device := m.container.NewDevice()
	runtime := m.newRuntime(tenantID, device)

	m.mu.Lock()
	if current, ok := m.runtimes[tenantID]; ok && current != nil {
		current.client.Disconnect()
	}
	m.runtimes[tenantID] = runtime
	m.mu.Unlock()

	return runtime, nil
}

func (m *SessionManager) newRuntime(tenantID string, device *store.Device) *tenantRuntime {
	client := whatsmeow.NewClient(device, waLog.Stdout("barbera-wa", "ERROR", false))
	runtime := &tenantRuntime{
		tenantID: tenantID,
		client:   client,
		device:   device,
	}
	client.AddEventHandler(func(evt any) {
		m.handleEvent(tenantID, client, evt)
	})
	return runtime
}

func (m *SessionManager) handleEvent(tenantID string, client *whatsmeow.Client, evt any) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	switch typed := evt.(type) {
	case *events.Connected:
		_ = m.persistConnected(ctx, tenantID, client)
	case *events.PairSuccess:
		_ = m.persistPairSuccess(ctx, tenantID, client, typed.BusinessName)
	case *events.Message:
		go m.handleIncomingMessage(tenantID, client, typed)
	case *events.Disconnected:
		_ = m.persistDisconnected(ctx, tenantID, "", "disconnected")
	case *events.LoggedOut:
		_ = m.persistDisconnected(ctx, tenantID, typed.PermanentDisconnectDescription(), "logged_out")
	}
}

func (m *SessionManager) consumeQRChannel(tenantID string, qrChan <-chan whatsmeow.QRChannelItem, cancel context.CancelFunc) {
	defer func() {
		if cancel != nil {
			cancel()
		}
	}()

	for item := range qrChan {
		switch item.Event {
		case whatsmeow.QRChannelEventCode:
			expiresAt := time.Now().UTC().Add(item.Timeout)
			_ = m.persistPairingQR(context.Background(), tenantID, item.Code, expiresAt)
		case whatsmeow.QRChannelTimeout.Event:
			_ = m.markError(context.Background(), tenantID, "QR WhatsApp timeout, silakan generate ulang")
		case whatsmeow.QRChannelSuccess.Event:
			_, _ = m.db.ExecContext(context.Background(), `
				UPDATE tenant_whatsapp_sessions
				SET pairing_code = '',
					metadata = COALESCE(metadata, '{}'::jsonb) - 'pairing_qr',
					pairing_expires_at = NULL,
					last_error = '',
					updated_at = NOW()
				WHERE tenant_id = $1
			`, tenantID)
		case "error":
			message := "terjadi error pada pairing channel WhatsApp"
			if item.Error != nil {
				message = item.Error.Error()
			}
			_ = m.markError(context.Background(), tenantID, message)
		}
	}
}

func (m *SessionManager) handleIncomingMessage(tenantID string, client *whatsmeow.Client, evt *events.Message) {
	if m.handler == nil || evt == nil || evt.Info.IsGroup {
		return
	}

	text := extractTextMessage(evt)
	if text == "" {
		return
	}

	selfCommand := false
	senderNumber := normalizeSessionPhone(evt.Info.Sender.User)
	if evt.Info.IsFromMe && client != nil && client.Store != nil && client.Store.ID != nil {
		selfNumber := normalizeSessionPhone(client.Store.ID.User)
		if selfNumber != "" && normalizeSessionPhone(evt.Info.Chat.User) == selfNumber {
			selfCommand = true
			senderNumber = selfNumber
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	result, err := m.handler.HandleIncomingOwnerMessage(ctx, tenantID, IncomingOwnerMessageInput{
		SenderNumber:  senderNumber,
		SenderName:    strings.TrimSpace(evt.Info.PushName),
		Command:       text,
		IsSelfCommand: selfCommand,
	})
	if err != nil || !result.Handled {
		return
	}

	if client == nil || !client.IsConnected() || !client.IsLoggedIn() {
		return
	}

	sendErr := m.sendIncomingReply(ctx, client, evt.Info.Chat, result)
	if sendErr == nil {
		_, _ = m.db.ExecContext(ctx, `
			UPDATE tenant_whatsapp_sessions
			SET last_message_at = NOW(),
				last_error = '',
				updated_at = NOW()
			WHERE tenant_id = $1
		`, tenantID)
	}
}

func (m *SessionManager) sendIncomingReply(ctx context.Context, client *whatsmeow.Client, chat waTypes.JID, result IncomingOwnerMessageResult) error {
	if client == nil {
		return fmt.Errorf("client whatsapp belum tersedia")
	}

	if result.Interactive != nil {
		msg, err := buildInteractiveReplyMessage(result)
		if err == nil {
			if _, sendErr := client.SendMessage(ctx, chat, msg); sendErr == nil {
				return nil
			} else {
				m.logger.Warn("interactive whatsapp reply failed, fallback to text", "err", sendErr, "chat", chat.String())
			}
		} else {
			m.logger.Warn("build interactive whatsapp reply failed, fallback to text", "err", err)
		}
	}

	if strings.TrimSpace(result.ReplyText) == "" {
		return nil
	}

	_, err := client.SendMessage(ctx, chat, &waE2E.Message{
		Conversation: proto.String(result.ReplyText),
	})
	return err
}

func buildInteractiveReplyMessage(result IncomingOwnerMessageResult) (*waE2E.Message, error) {
	if result.Interactive == nil {
		return nil, fmt.Errorf("interactive reply kosong")
	}

	switch strings.ToLower(strings.TrimSpace(result.Interactive.Type)) {
	case "template_buttons":
		buttons := make([]*waE2E.HydratedTemplateButton, 0, len(result.Interactive.Buttons))
		index := 1
		for _, button := range result.Interactive.Buttons {
			title := strings.TrimSpace(button.Title)
			if title == "" {
				continue
			}

			item := &waE2E.HydratedTemplateButton{
				Index: proto.Uint32(uint32(index)),
			}

			switch strings.ToLower(strings.TrimSpace(button.Kind)) {
			case "quick_reply":
				buttonID := strings.TrimSpace(button.ID)
				if buttonID == "" {
					continue
				}
				item.HydratedButton = &waE2E.HydratedTemplateButton_QuickReplyButton{
					QuickReplyButton: &waE2E.HydratedTemplateButton_HydratedQuickReplyButton{
						DisplayText: proto.String(title),
						ID:          proto.String(buttonID),
					},
				}
			case "url":
				buttonURL := strings.TrimSpace(button.URL)
				if buttonURL == "" {
					continue
				}
				item.HydratedButton = &waE2E.HydratedTemplateButton_UrlButton{
					UrlButton: &waE2E.HydratedTemplateButton_HydratedURLButton{
						DisplayText: proto.String(title),
						URL:         proto.String(buttonURL),
					},
				}
			case "call":
				phoneNumber := normalizeSessionPhone(button.Phone)
				if phoneNumber == "" {
					continue
				}
				item.HydratedButton = &waE2E.HydratedTemplateButton_CallButton{
					CallButton: &waE2E.HydratedTemplateButton_HydratedCallButton{
						DisplayText: proto.String(title),
						PhoneNumber: proto.String(phoneNumber),
					},
				}
			default:
				continue
			}

			buttons = append(buttons, item)
			index++
			if len(buttons) >= 3 {
				break
			}
		}
		if len(buttons) == 0 {
			return nil, fmt.Errorf("interactive reply tidak punya tombol")
		}

		description := strings.TrimSpace(result.Interactive.Description)
		if description == "" {
			description = strings.TrimSpace(result.ReplyText)
		}
		template := &waE2E.TemplateMessage_HydratedFourRowTemplate{
			HydratedContentText: proto.String(description),
			HydratedButtons:     buttons,
		}
		if title := strings.TrimSpace(result.Interactive.Title); title != "" {
			template.Title = &waE2E.TemplateMessage_HydratedFourRowTemplate_HydratedTitleText{
				HydratedTitleText: title,
			}
		}
		if footer := strings.TrimSpace(result.Interactive.Footer); footer != "" {
			template.HydratedFooterText = proto.String(footer)
		}

		templateMessage := &waE2E.TemplateMessage{
			Format: &waE2E.TemplateMessage_HydratedFourRowTemplate_{
				HydratedFourRowTemplate: template,
			},
			HydratedTemplate: template,
		}
		return &waE2E.Message{TemplateMessage: templateMessage}, nil
	case "list":
		sections := make([]*waE2E.ListMessage_Section, 0, len(result.Interactive.Sections))
		for _, section := range result.Interactive.Sections {
			rows := make([]*waE2E.ListMessage_Row, 0, len(section.Options))
			for _, option := range section.Options {
				optionID := strings.TrimSpace(option.ID)
				optionTitle := strings.TrimSpace(option.Title)
				if optionID == "" || optionTitle == "" {
					continue
				}
				row := &waE2E.ListMessage_Row{
					RowID: proto.String(optionID),
					Title: proto.String(optionTitle),
				}
				if description := strings.TrimSpace(option.Description); description != "" {
					row.Description = proto.String(description)
				}
				rows = append(rows, row)
			}
			if len(rows) == 0 {
				continue
			}
			entry := &waE2E.ListMessage_Section{Rows: rows}
			if title := strings.TrimSpace(section.Title); title != "" {
				entry.Title = proto.String(title)
			}
			sections = append(sections, entry)
		}
		if len(sections) == 0 {
			return nil, fmt.Errorf("interactive reply tidak punya opsi")
		}

		buttonText := strings.TrimSpace(result.Interactive.ButtonText)
		if buttonText == "" {
			buttonText = "Pilih Menu"
		}
		description := strings.TrimSpace(result.Interactive.Description)
		if description == "" {
			description = strings.TrimSpace(result.ReplyText)
		}

		listType := waE2E.ListMessage_SINGLE_SELECT
		message := &waE2E.ListMessage{
			ButtonText: proto.String(buttonText),
			ListType:   &listType,
			Sections:   sections,
		}
		if title := strings.TrimSpace(result.Interactive.Title); title != "" {
			message.Title = proto.String(title)
		}
		if description != "" {
			message.Description = proto.String(description)
		}
		if footer := strings.TrimSpace(result.Interactive.Footer); footer != "" {
			message.FooterText = proto.String(footer)
		}
		return &waE2E.Message{ListMessage: message}, nil
	default:
		return nil, fmt.Errorf("interactive reply type %q belum didukung", result.Interactive.Type)
	}
}

func (m *SessionManager) persistConnected(ctx context.Context, tenantID string, client *whatsmeow.Client) error {
	deviceJID := ""
	if client.Store != nil && client.Store.ID != nil {
		deviceJID = client.Store.ID.String()
	}
	businessName := ""
	if client.Store != nil {
		businessName = strings.TrimSpace(client.Store.BusinessName)
	}

	_, err := m.db.ExecContext(ctx, `
		INSERT INTO tenant_whatsapp_sessions (
			tenant_id,
			status,
			session_mode,
			business_name,
			device_jid,
			last_connected_at,
			last_seen_at,
			last_error,
			pairing_code,
			pairing_expires_at,
			metadata,
			updated_at
		)
		VALUES ($1, 'connected', 'qr_code', $2, $3, NOW(), NOW(), '', '', NULL, '{}'::jsonb, NOW())
		ON CONFLICT (tenant_id)
		DO UPDATE SET
			status = 'connected',
			session_mode = 'qr_code',
			business_name = EXCLUDED.business_name,
			device_jid = EXCLUDED.device_jid,
			last_connected_at = NOW(),
			last_seen_at = NOW(),
			last_error = '',
			pairing_code = '',
			pairing_expires_at = NULL,
			metadata = '{}'::jsonb,
			updated_at = NOW()
	`, tenantID, businessName, deviceJID)
	return err
}

func (m *SessionManager) persistPairSuccess(ctx context.Context, tenantID string, client *whatsmeow.Client, businessName string) error {
	deviceJID := ""
	phoneNumber := ""
	if client.Store != nil && client.Store.ID != nil {
		deviceJID = client.Store.ID.String()
		phoneNumber = normalizeSessionPhone(client.Store.ID.User)
	}
	if strings.TrimSpace(businessName) == "" && client.Store != nil {
		businessName = strings.TrimSpace(client.Store.BusinessName)
	}

	_, err := m.db.ExecContext(ctx, `
		UPDATE tenant_whatsapp_sessions
		SET device_jid = $2,
			phone_number = CASE WHEN $3 <> '' THEN $3 ELSE phone_number END,
			business_name = CASE WHEN $4 <> '' THEN $4 ELSE business_name END,
			last_error = '',
			updated_at = NOW()
		WHERE tenant_id = $1
	`, tenantID, deviceJID, phoneNumber, strings.TrimSpace(businessName))
	return err
}

func (m *SessionManager) persistDisconnected(ctx context.Context, tenantID string, lastError string, status string) error {
	if status == "" {
		status = "disconnected"
	}
	_, err := m.db.ExecContext(ctx, `
		INSERT INTO tenant_whatsapp_sessions (tenant_id, status, last_error, last_seen_at, updated_at)
		VALUES ($1, $2, $3, NOW(), NOW())
		ON CONFLICT (tenant_id)
		DO UPDATE SET
			status = EXCLUDED.status,
			pairing_code = '',
			pairing_expires_at = NULL,
			metadata = COALESCE(tenant_whatsapp_sessions.metadata, '{}'::jsonb) - 'pairing_qr',
			last_error = CASE WHEN EXCLUDED.last_error <> '' THEN EXCLUDED.last_error ELSE tenant_whatsapp_sessions.last_error END,
			last_seen_at = NOW(),
			updated_at = NOW()
	`, tenantID, status, strings.TrimSpace(lastError))
	return err
}

func (m *SessionManager) markError(ctx context.Context, tenantID string, message string) error {
	return m.persistDisconnected(ctx, tenantID, message, "error")
}

func (m *SessionManager) persistPairingQR(ctx context.Context, tenantID string, qrCode string, expiresAt time.Time) error {
	metadata, err := json.Marshal(map[string]any{
		"pairing_qr": strings.TrimSpace(qrCode),
	})
	if err != nil {
		return fmt.Errorf("marshal whatsapp session metadata: %w", err)
	}

	_, err = m.db.ExecContext(ctx, `
		INSERT INTO tenant_whatsapp_sessions (
			tenant_id,
			status,
			session_mode,
			pairing_code,
			pairing_expires_at,
			metadata,
			last_error,
			updated_at
		)
		VALUES ($1, 'pairing', 'qr_code', '', $2, $3::jsonb, '', NOW())
		ON CONFLICT (tenant_id)
		DO UPDATE SET
			status = 'pairing',
			session_mode = 'qr_code',
			pairing_code = '',
			pairing_expires_at = EXCLUDED.pairing_expires_at,
			metadata = EXCLUDED.metadata,
			last_error = '',
			updated_at = NOW()
	`, tenantID, expiresAt, metadata)
	if err != nil {
		return fmt.Errorf("simpan qr pairing whatsapp: %w", err)
	}
	return nil
}

func (m *SessionManager) loadSessionState(ctx context.Context, tenantID string) (SessionState, error) {
	if _, err := m.db.ExecContext(ctx, `
		INSERT INTO tenant_whatsapp_sessions (tenant_id)
		VALUES ($1)
		ON CONFLICT (tenant_id) DO NOTHING
	`, tenantID); err != nil {
		return SessionState{}, fmt.Errorf("ensure whatsapp session row: %w", err)
	}

	state := SessionState{}
	if err := m.db.QueryRowContext(ctx, `
		SELECT
			status,
			session_mode,
			phone_number,
			business_name,
			device_jid,
			pairing_code,
			pairing_expires_at,
			last_connected_at,
			last_seen_at,
			last_message_at,
			last_error,
			metadata
		FROM tenant_whatsapp_sessions
		WHERE tenant_id = $1
		LIMIT 1
	`, tenantID).Scan(
		&state.Status,
		&state.SessionMode,
		&state.PhoneNumber,
		&state.BusinessName,
		&state.DeviceJID,
		&state.PairingCode,
		&sessionTimeTarget{target: &state.PairingExpiresAt},
		&sessionTimeTarget{target: &state.LastConnectedAt},
		&sessionTimeTarget{target: &state.LastSeenAt},
		&sessionTimeTarget{target: &state.LastMessageAt},
		&state.LastError,
		&sessionMetadataTarget{state: &state},
	); err != nil {
		return SessionState{}, fmt.Errorf("load whatsapp session state: %w", err)
	}

	runtime := m.runtime(tenantID)
	if runtime != nil {
		state.IsConnected = runtime.client.IsConnected()
		state.IsLoggedIn = runtime.client.IsLoggedIn()
	}
	return state, nil
}

func (m *SessionManager) runtime(tenantID string) *tenantRuntime {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.runtimes[tenantID]
}

func (m *SessionManager) ensureReady() error {
	if m == nil {
		return fmt.Errorf("whatsapp session manager belum diinisialisasi")
	}
	if m.initErr != nil {
		return m.initErr
	}
	return nil
}

func normalizeSessionPhone(value string) string {
	value = digitsOnly(value)
	switch {
	case value == "":
		return ""
	case strings.HasPrefix(value, "0"):
		return "62" + strings.TrimPrefix(value, "0")
	case strings.HasPrefix(value, "62"):
		return value
	default:
		return value
	}
}

func extractTextMessage(evt *events.Message) string {
	if evt == nil {
		return ""
	}
	message := evt.Message
	if message == nil && evt.RawMessage != nil {
		message = evt.UnwrapRaw().Message
	}
	if message == nil {
		return ""
	}

	if text := strings.TrimSpace(message.GetConversation()); text != "" {
		return text
	}
	if extended := strings.TrimSpace(message.GetExtendedTextMessage().GetText()); extended != "" {
		return extended
	}
	if buttonID := strings.TrimSpace(message.GetButtonsResponseMessage().GetSelectedButtonID()); buttonID != "" {
		return buttonID
	}
	if buttonText := strings.TrimSpace(message.GetButtonsResponseMessage().GetSelectedDisplayText()); buttonText != "" {
		return buttonText
	}
	if rowID := strings.TrimSpace(message.GetListResponseMessage().GetSingleSelectReply().GetSelectedRowID()); rowID != "" {
		return rowID
	}
	if templateID := strings.TrimSpace(message.GetTemplateButtonReplyMessage().GetSelectedID()); templateID != "" {
		return templateID
	}
	if templateText := strings.TrimSpace(message.GetTemplateButtonReplyMessage().GetSelectedDisplayText()); templateText != "" {
		return templateText
	}
	return ""
}

func digitsOnly(value string) string {
	var builder strings.Builder
	builder.Grow(len(value))
	for _, char := range value {
		if char >= '0' && char <= '9' {
			builder.WriteRune(char)
		}
	}
	return builder.String()
}

type sessionTimeTarget struct {
	target **time.Time
}

func (n *sessionTimeTarget) Scan(value any) error {
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

type sessionMetadataTarget struct {
	state *SessionState
}

func (n *sessionMetadataTarget) Scan(value any) error {
	if n == nil || n.state == nil || value == nil {
		return nil
	}

	var raw []byte
	switch typed := value.(type) {
	case []byte:
		raw = typed
	case string:
		raw = []byte(typed)
	default:
		return fmt.Errorf("unsupported metadata value %T", value)
	}

	if len(raw) == 0 {
		return nil
	}

	var payload struct {
		PairingQR string `json:"pairing_qr"`
	}
	if err := json.Unmarshal(raw, &payload); err != nil {
		return fmt.Errorf("parse whatsapp session metadata: %w", err)
	}
	n.state.PairingQR = strings.TrimSpace(payload.PairingQR)
	return nil
}
