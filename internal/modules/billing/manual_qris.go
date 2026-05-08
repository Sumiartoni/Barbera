package billing

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"
)

type rowQueryer interface {
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

type manualQRISConfig struct {
	QRISLabel            string
	QRISOwnerName        string
	QRISPayload          string
	QRISImageURL         string
	WalletProvider       string
	WalletAccount        string
	ForwarderSecret      string
	PaymentWindowMinutes int
	MatchGraceMinutes    int
	UniqueCodeMin        int64
	UniqueCodeMax        int64
}

func defaultManualQRISConfig() manualQRISConfig {
	return manualQRISConfig{
		QRISLabel:            "QRIS DANA Pribadi",
		QRISOwnerName:        "BARBERA Owner",
		QRISPayload:          "",
		QRISImageURL:         "",
		WalletProvider:       "DANA",
		WalletAccount:        "",
		ForwarderSecret:      "",
		PaymentWindowMinutes: 30,
		MatchGraceMinutes:    10,
		UniqueCodeMin:        1,
		UniqueCodeMax:        499,
	}
}

func (s *Service) loadManualQRISConfig(ctx context.Context, q rowQueryer) (manualQRISConfig, error) {
	config := defaultManualQRISConfig()

	var raw []byte
	err := q.QueryRowContext(ctx, `
		SELECT config
		FROM platform_configurations
		WHERE config_key = 'manual-qris-payment'
	`).Scan(&raw)
	if err != nil {
		if err == sql.ErrNoRows {
			return config, nil
		}
		return config, fmt.Errorf("load manual qris config: %w", err)
	}

	values := map[string]any{}
	if len(raw) > 0 {
		if err := json.Unmarshal(raw, &values); err != nil {
			return config, fmt.Errorf("parse manual qris config: %w", err)
		}
	}

	if value := strings.TrimSpace(stringConfig(values["qris_label"])); value != "" {
		config.QRISLabel = value
	}
	if value := strings.TrimSpace(stringConfig(values["qris_owner_name"])); value != "" {
		config.QRISOwnerName = value
	}
	if value := strings.TrimSpace(stringConfig(values["qris_payload"])); value != "" {
		config.QRISPayload = value
	}
	if value := strings.TrimSpace(stringConfig(values["qris_image_url"])); value != "" {
		config.QRISImageURL = value
	}
	if value := strings.TrimSpace(stringConfig(values["wallet_provider"])); value != "" {
		config.WalletProvider = value
	}
	if value := strings.TrimSpace(stringConfig(values["wallet_account"])); value != "" {
		config.WalletAccount = value
	}
	if value := strings.TrimSpace(stringConfig(values["forwarder_secret"])); value != "" {
		config.ForwarderSecret = value
	}
	if value := intConfig(values["payment_window_minutes"]); value > 0 {
		config.PaymentWindowMinutes = value
	}
	if value := intConfig(values["match_grace_minutes"]); value > 0 {
		config.MatchGraceMinutes = value
	}
	if value := int64(intConfig(values["unique_code_min"])); value > 0 {
		config.UniqueCodeMin = value
	}
	if value := int64(intConfig(values["unique_code_max"])); value > 0 {
		config.UniqueCodeMax = value
	}
	if config.UniqueCodeMax < config.UniqueCodeMin {
		config.UniqueCodeMax = config.UniqueCodeMin
	}

	return config, nil
}

func (s *Service) allocateUniquePayment(ctx context.Context, tx *sql.Tx, totalAmountIDR int64, cfg manualQRISConfig) (int64, int64, time.Time, string, error) {
	if totalAmountIDR <= 0 {
		return 0, 0, time.Time{}, "", nil
	}

	now := time.Now().UTC()
	expiry := now.Add(time.Duration(cfg.PaymentWindowMinutes) * time.Minute)
	rangeSize := cfg.UniqueCodeMax - cfg.UniqueCodeMin + 1
	if rangeSize <= 0 {
		rangeSize = 1
	}

	seed := int64(now.UnixNano()) % rangeSize
	for attempt := int64(0); attempt < rangeSize; attempt++ {
		uniqueAmount := cfg.UniqueCodeMin + ((seed + attempt) % rangeSize)
		paymentAmount := totalAmountIDR + uniqueAmount

		var exists bool
		if err := tx.QueryRowContext(ctx, `
			SELECT EXISTS(
				SELECT 1
				FROM billing_orders
				WHERE payment_channel = 'manual_qris'
				  AND status IN ('pending_payment', 'waiting_confirmation')
				  AND payment_amount_idr = $1
				  AND (
					payment_expires_at IS NULL
					OR payment_expires_at >= $2
				  )
			)
		`, paymentAmount, now.Add(-time.Duration(cfg.MatchGraceMinutes)*time.Minute)).Scan(&exists); err != nil {
			return 0, 0, time.Time{}, "", fmt.Errorf("check unique payment amount: %w", err)
		}
		if exists {
			continue
		}

		reference := fmt.Sprintf("BARB-%s-%03d", now.Format("20060102150405"), uniqueAmount)
		return uniqueAmount, paymentAmount, expiry, reference, nil
	}

	return 0, 0, time.Time{}, "", fmt.Errorf("tidak ada nominal unik yang tersedia saat ini")
}

var currencyCandidatePattern = regexp.MustCompile(`(?i)(?:rp\s*)?([0-9][0-9\.\,\s]{2,})`)

func parseIDRAmountFromText(parts ...string) int64 {
	var best int64
	for _, part := range parts {
		matches := currencyCandidatePattern.FindAllStringSubmatch(part, -1)
		for _, match := range matches {
			if len(match) < 2 {
				continue
			}
			digits := onlyDigits(match[1])
			if len(digits) < 3 {
				continue
			}
			value, err := strconv.ParseInt(digits, 10, 64)
			if err != nil {
				continue
			}
			if value > best {
				best = value
			}
		}
	}
	return best
}

func parseForwarderReceivedAt(raw string) time.Time {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return time.Now().UTC()
	}
	if parsed, err := time.Parse(time.RFC3339, raw); err == nil {
		return parsed.UTC()
	}
	if parsed, err := time.Parse("2006-01-02 15:04:05", raw); err == nil {
		return parsed.UTC()
	}
	return time.Now().UTC()
}

func normalizeWhatsAppPhone(value string) string {
	value = onlyDigits(value)
	switch {
	case strings.HasPrefix(value, "0"):
		return "62" + strings.TrimPrefix(value, "0")
	case strings.HasPrefix(value, "62"):
		return value
	default:
		return value
	}
}

func onlyDigits(value string) string {
	var builder strings.Builder
	builder.Grow(len(value))
	for _, r := range value {
		if r >= '0' && r <= '9' {
			builder.WriteRune(r)
		}
	}
	return builder.String()
}

func stringConfig(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	default:
		return ""
	}
}

func intConfig(value any) int {
	switch typed := value.(type) {
	case float64:
		return int(typed)
	case float32:
		return int(typed)
	case int:
		return typed
	case int32:
		return int(typed)
	case int64:
		return int(typed)
	case string:
		parsed, _ := strconv.Atoi(strings.TrimSpace(typed))
		return parsed
	default:
		return 0
	}
}

func (s *Service) ProcessForwarderNotification(ctx context.Context, input ForwarderNotificationInput) (ForwarderNotificationResult, error) {
	cfg, err := s.loadManualQRISConfig(ctx, s.db)
	if err != nil {
		return ForwarderNotificationResult{}, err
	}
	if strings.TrimSpace(cfg.ForwarderSecret) == "" {
		return ForwarderNotificationResult{}, fmt.Errorf("secret forwarder payment belum dikonfigurasi")
	}
	if strings.TrimSpace(input.Secret) != strings.TrimSpace(cfg.ForwarderSecret) {
		return ForwarderNotificationResult{}, fmt.Errorf("secret forwarder payment tidak valid")
	}

	receivedAt := parseForwarderReceivedAt(input.ReceivedAt)
	amountIDR := input.AmountIDR
	if amountIDR <= 0 {
		amountIDR = parseIDRAmountFromText(input.Title, input.Message)
	}

	rawPayload := input.RawPayload
	if rawPayload == nil {
		rawPayload = map[string]any{}
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return ForwarderNotificationResult{}, fmt.Errorf("begin forwarder notification tx: %w", err)
	}
	defer tx.Rollback()

	notification := ForwarderNotificationResult{}
	matchStatus := "pending"
	if amountIDR <= 0 {
		matchStatus = "invalid"
	}

	if err := tx.QueryRowContext(ctx, `
		INSERT INTO billing_payment_notifications (
			source,
			app_name,
			title,
			message,
			sender,
			amount_idr,
			received_at,
			match_status,
			raw_payload
		)
		VALUES ('android_forwarder', $1, $2, $3, $4, $5, $6, $7, $8::jsonb)
		RETURNING id
	`, strings.TrimSpace(input.AppName), strings.TrimSpace(input.Title), strings.TrimSpace(input.Message), strings.TrimSpace(input.Sender), amountIDR, receivedAt, matchStatus, mustJSON(rawPayload)).Scan(&notification.NotificationID); err != nil {
		return ForwarderNotificationResult{}, fmt.Errorf("insert payment notification: %w", err)
	}

	if amountIDR <= 0 {
		notification.MatchStatus = "invalid"
		notification.Message = "Nominal transaksi tidak dapat dibaca dari notifikasi."
		if _, err := tx.ExecContext(ctx, `
			UPDATE billing_payment_notifications
			SET processed_at = NOW()
			WHERE id = $1
		`, notification.NotificationID); err != nil {
			return ForwarderNotificationResult{}, fmt.Errorf("mark invalid payment notification: %w", err)
		}
		if err := tx.Commit(); err != nil {
			return ForwarderNotificationResult{}, fmt.Errorf("commit invalid payment notification: %w", err)
		}
		return notification, nil
	}

	rows, err := tx.QueryContext(ctx, `
		SELECT id
		FROM billing_orders
		WHERE payment_channel = 'manual_qris'
		  AND status IN ('pending_payment', 'waiting_confirmation')
		  AND payment_amount_idr = $1
		  AND (
			payment_expires_at IS NULL
			OR payment_expires_at >= $2
		  )
		ORDER BY created_at ASC
		LIMIT 3
	`, amountIDR, receivedAt.Add(-time.Duration(cfg.MatchGraceMinutes)*time.Minute))
	if err != nil {
		return ForwarderNotificationResult{}, fmt.Errorf("query candidate billing orders: %w", err)
	}
	defer rows.Close()

	candidateIDs := make([]string, 0, 3)
	for rows.Next() {
		var orderID string
		if err := rows.Scan(&orderID); err != nil {
			return ForwarderNotificationResult{}, fmt.Errorf("scan candidate billing order: %w", err)
		}
		candidateIDs = append(candidateIDs, orderID)
	}
	if err := rows.Err(); err != nil {
		return ForwarderNotificationResult{}, fmt.Errorf("iterate candidate billing orders: %w", err)
	}

	switch len(candidateIDs) {
	case 0:
		notification.MatchStatus = "unmatched"
		notification.Message = "Tidak ada order aktif dengan nominal unik tersebut."
		if _, err := tx.ExecContext(ctx, `
			UPDATE billing_payment_notifications
			SET match_status = 'unmatched',
				processed_at = NOW()
			WHERE id = $1
		`, notification.NotificationID); err != nil {
			return ForwarderNotificationResult{}, fmt.Errorf("update unmatched payment notification: %w", err)
		}
	case 1:
		order, err := s.updateOrderStatusTx(ctx, tx, candidateIDs[0], OrderStatusInput{
			Status:        "paid",
			PaidAmountIDR: amountIDR,
			ConfirmSource: "android_forwarder",
		}, notification.NotificationID, receivedAt)
		if err != nil {
			return ForwarderNotificationResult{}, err
		}
		notification.MatchStatus = "matched"
		notification.OrderID = order.ID
		notification.OrderStatus = order.Status
		notification.PaymentAmountIDR = order.PaymentAmountIDR
		notification.Message = "Pembayaran berhasil dicocokkan dan order otomatis diaktifkan."
		if _, err := tx.ExecContext(ctx, `
			UPDATE billing_payment_notifications
			SET match_status = 'matched',
				matched_order_id = $2,
				processed_at = NOW()
			WHERE id = $1
		`, notification.NotificationID, order.ID); err != nil {
			return ForwarderNotificationResult{}, fmt.Errorf("update matched payment notification: %w", err)
		}
	case 2, 3:
		notification.MatchStatus = "ambiguous"
		notification.Message = "Ditemukan lebih dari satu order dengan nominal yang sama. Perlu review manual."
		if _, err := tx.ExecContext(ctx, `
			UPDATE billing_payment_notifications
			SET match_status = 'ambiguous',
				processed_at = NOW()
			WHERE id = $1
		`, notification.NotificationID); err != nil {
			return ForwarderNotificationResult{}, fmt.Errorf("update ambiguous payment notification: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return ForwarderNotificationResult{}, fmt.Errorf("commit payment notification reconciliation: %w", err)
	}

	return notification, nil
}

func mustJSON(value map[string]any) []byte {
	raw, err := json.Marshal(value)
	if err != nil {
		return []byte(`{}`)
	}
	return raw
}
