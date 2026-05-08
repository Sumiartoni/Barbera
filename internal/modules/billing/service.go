package billing

import (
	"context"
	"database/sql"
	"encoding/json"
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

func (s *Service) GetSummary(ctx context.Context, tenantID string) (Summary, error) {
	summary := Summary{}
	var currentPeriodEnd sql.NullTime
	err := s.db.QueryRowContext(ctx, `
		SELECT
			COALESCE(p.code, 'free'),
			COALESCE(p.name, 'Free'),
			COALESCE(p.is_free, TRUE),
			COALESCE(ts.custom_monthly_price_idr, p.monthly_price_idr, 0),
			COALESCE(p.yearly_price_idr, 0),
			COALESCE(p.billing_cycle_days, 30),
			ts.current_period_end,
			COALESCE(pl.max_outlets, 1),
			COALESCE(pl.max_users, 1),
			COALESCE(pl.max_customers, 100),
			COALESCE(pl.max_reminders_per_month, 50),
			COALESCE(pl.max_whatsapp_sessions, 1),
			COALESCE(pl.allow_campaigns, FALSE),
			COALESCE(pl.allow_loyalty, FALSE),
			COALESCE(pl.allow_exports, FALSE),
			COALESCE(pl.allow_multi_outlet, FALSE)
		FROM tenants t
		LEFT JOIN LATERAL (
			SELECT plan_id, custom_monthly_price_idr, current_period_end
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
		&summary.PlanCode,
		&summary.PlanName,
		&summary.IsFree,
		&summary.MonthlyPriceIDR,
		&summary.YearlyPriceIDR,
		&summary.BillingCycleDays,
		&currentPeriodEnd,
		&summary.MaxOutlets,
		&summary.MaxUsers,
		&summary.MaxCustomers,
		&summary.MaxRemindersPerMonth,
		&summary.MaxWhatsAppSessions,
		&summary.AllowCampaigns,
		&summary.AllowLoyalty,
		&summary.AllowExports,
		&summary.AllowMultiOutlet,
	)
	if err != nil {
		return Summary{}, fmt.Errorf("load billing summary: %w", err)
	}

	if currentPeriodEnd.Valid {
		value := currentPeriodEnd.Time.UTC()
		summary.CurrentPeriodEnd = &value
	}

	return summary, nil
}

func (s *Service) ListCatalog(ctx context.Context) ([]CatalogPlan, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT
			p.code,
			p.name,
			p.description,
			p.is_free,
			p.monthly_price_idr,
			p.yearly_price_idr,
			p.billing_cycle_days,
			COALESCE(pl.max_outlets, 1),
			COALESCE(pl.max_users, 1),
			COALESCE(pl.max_customers, 100),
			COALESCE(pl.max_reminders_per_month, 50),
			COALESCE(pl.max_whatsapp_sessions, 1),
			COALESCE(pl.allow_campaigns, FALSE),
			COALESCE(pl.allow_loyalty, FALSE),
			COALESCE(pl.allow_exports, FALSE),
			COALESCE(pl.allow_multi_outlet, FALSE)
		FROM plans p
		INNER JOIN plan_limits pl ON pl.plan_id = p.id
		WHERE p.is_active = TRUE
		ORDER BY p.display_order ASC, p.name ASC
	`)
	if err != nil {
		return nil, fmt.Errorf("list billing catalog: %w", err)
	}
	defer rows.Close()

	plans := make([]CatalogPlan, 0, 3)
	for rows.Next() {
		var item CatalogPlan
		if err := rows.Scan(
			&item.Code,
			&item.Name,
			&item.Description,
			&item.IsFree,
			&item.MonthlyPriceIDR,
			&item.YearlyPriceIDR,
			&item.BillingCycleDays,
			&item.MaxOutlets,
			&item.MaxUsers,
			&item.MaxCustomers,
			&item.MaxRemindersPerMonth,
			&item.MaxWhatsAppSessions,
			&item.AllowCampaigns,
			&item.AllowLoyalty,
			&item.AllowExports,
			&item.AllowMultiOutlet,
		); err != nil {
			return nil, fmt.Errorf("scan billing catalog plan: %w", err)
		}
		plans = append(plans, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate billing catalog: %w", err)
	}

	return plans, nil
}

func (s *Service) CreateOrder(ctx context.Context, tenantID string, actorUserID string, input CreateOrderInput) (Order, error) {
	tenantID = strings.TrimSpace(tenantID)
	actorUserID = strings.TrimSpace(actorUserID)
	planCode := strings.TrimSpace(strings.ToLower(input.PlanCode))
	billingCycle := strings.TrimSpace(strings.ToLower(input.BillingCycle))
	paymentChannel := strings.TrimSpace(strings.ToLower(input.PaymentChannel))
	couponCode := strings.TrimSpace(strings.ToUpper(input.CouponCode))
	if tenantID == "" || planCode == "" {
		return Order{}, fmt.Errorf("billing order validation failed")
	}
	if billingCycle == "" {
		billingCycle = "monthly"
	}
	if billingCycle != "monthly" && billingCycle != "yearly" {
		return Order{}, fmt.Errorf("billing cycle is invalid")
	}
	if paymentChannel == "" {
		paymentChannel = "manual_qris"
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return Order{}, fmt.Errorf("begin billing order tx: %w", err)
	}
	defer tx.Rollback()

	var (
		planID           string
		planName         string
		isFree           bool
		monthlyPriceIDR  int64
		yearlyPriceIDR   int64
		defaultCycleDays int
	)
	if err := tx.QueryRowContext(ctx, `
		SELECT id, name, is_free, monthly_price_idr, yearly_price_idr, billing_cycle_days
		FROM plans
		WHERE code = $1
		  AND is_active = TRUE
		LIMIT 1
	`, planCode).Scan(&planID, &planName, &isFree, &monthlyPriceIDR, &yearlyPriceIDR, &defaultCycleDays); err != nil {
		return Order{}, fmt.Errorf("load target plan for order: %w", err)
	}

	baseAmountIDR := monthlyPriceIDR
	billingCycleDays := defaultCycleDays
	if isFree {
		billingCycle = "monthly"
		baseAmountIDR = 0
		billingCycleDays = 30
	} else if billingCycle == "yearly" {
		if yearlyPriceIDR > 0 {
			baseAmountIDR = yearlyPriceIDR
		} else {
			baseAmountIDR = monthlyPriceIDR * 12
		}
		billingCycleDays = 365
	}

	currentSummary, err := s.GetSummary(ctx, tenantID)
	if err != nil {
		return Order{}, err
	}
	if currentSummary.PlanCode == planCode && !isFree {
		return Order{}, fmt.Errorf("tenant sudah berada di paket %s", planCode)
	}

	discountType := ""
	var discountValue int64
	var discountAmountIDR int64
	if couponCode != "" {
		discountType, discountValue, discountAmountIDR, err = s.resolveCoupon(ctx, tx, couponCode, planCode, baseAmountIDR)
		if err != nil {
			return Order{}, err
		}
	}

	totalAmountIDR := baseAmountIDR - discountAmountIDR
	if totalAmountIDR < 0 {
		totalAmountIDR = 0
	}

	uniqueAmountIDR := int64(0)
	paymentAmountIDR := totalAmountIDR
	paymentReference := ""
	var paymentExpiresAt *time.Time
	paymentConfirmSource := ""
	paidAmountIDR := int64(0)
	metadata := map[string]any{
		"requested_by": strings.TrimSpace(actorUserID),
	}

	status := "pending_payment"
	if isFree || totalAmountIDR == 0 {
		status = "paid"
		paidAmountIDR = paymentAmountIDR
		paymentConfirmSource = "system_auto"
	} else if paymentChannel == "manual_qris" {
		paymentCfg, err := s.loadManualQRISConfig(ctx, tx)
		if err != nil {
			return Order{}, err
		}
		var expiresAt time.Time
		uniqueAmountIDR, paymentAmountIDR, expiresAt, paymentReference, err = s.allocateUniquePayment(ctx, tx, totalAmountIDR, paymentCfg)
		if err != nil {
			return Order{}, err
		}
		paymentExpiresAt = &expiresAt
		metadata["payment_instructions"] = map[string]any{
			"wallet_provider":        paymentCfg.WalletProvider,
			"qris_label":             paymentCfg.QRISLabel,
			"qris_owner_name":        paymentCfg.QRISOwnerName,
			"qris_payload":           paymentCfg.QRISPayload,
			"qris_image_url":         paymentCfg.QRISImageURL,
			"wallet_account":         paymentCfg.WalletAccount,
			"payment_window_minutes": paymentCfg.PaymentWindowMinutes,
			"auto_confirm":           strings.TrimSpace(paymentCfg.ForwarderSecret) != "",
		}
	}

	metadataRaw, err := json.Marshal(metadata)
	if err != nil {
		return Order{}, fmt.Errorf("marshal billing order metadata: %w", err)
	}

	record := Order{}
	err = tx.QueryRowContext(ctx, `
		INSERT INTO billing_orders (
			tenant_id,
			created_by_user_id,
			plan_id,
			plan_code,
			plan_name,
			billing_cycle,
			billing_cycle_days,
			base_amount_idr,
			coupon_code,
			discount_type,
			discount_value,
			discount_amount_idr,
			total_amount_idr,
			unique_amount_idr,
			payment_amount_idr,
			payment_reference,
			payment_expires_at,
			payment_channel,
			status,
			notes,
			metadata,
			paid_at,
			payment_confirm_source,
			paid_amount_idr
		)
		VALUES (
			$1,
			NULLIF($2, '')::uuid,
			$3,
			$4,
			$5,
			$6,
			$7,
			$8,
			$9,
			$10,
			$11,
			$12,
			$13,
			$14,
			$15,
			$16,
			$17,
			$18,
			$19,
			$20,
			$21::jsonb,
			CASE WHEN $19 = 'paid' THEN NOW() ELSE NULL END,
			$22,
			$23
		)
		RETURNING
			id,
			tenant_id,
			plan_code,
			plan_name,
			billing_cycle,
			billing_cycle_days,
			base_amount_idr,
			coupon_code,
			discount_type,
			discount_value,
			discount_amount_idr,
			total_amount_idr,
			unique_amount_idr,
			payment_amount_idr,
			payment_reference,
			payment_expires_at,
			payment_channel,
			status,
			notes,
			metadata,
			payment_confirm_source,
			paid_amount_idr,
			paid_at,
			created_at,
			updated_at
	`, tenantID, actorUserID, planID, planCode, planName, billingCycle, billingCycleDays, baseAmountIDR, couponCode, discountType, discountValue, discountAmountIDR, totalAmountIDR, uniqueAmountIDR, paymentAmountIDR, paymentReference, paymentExpiresAt, paymentChannel, status, strings.TrimSpace(input.Notes), metadataRaw, paymentConfirmSource, paidAmountIDR).Scan(
		&record.ID,
		&record.TenantID,
		&record.PlanCode,
		&record.PlanName,
		&record.BillingCycle,
		&record.BillingCycleDays,
		&record.BaseAmountIDR,
		&record.CouponCode,
		&record.DiscountType,
		&record.DiscountValue,
		&record.DiscountAmountIDR,
		&record.TotalAmountIDR,
		&record.UniqueAmountIDR,
		&record.PaymentAmountIDR,
		&record.PaymentReference,
		&sqlNullTimeTarget{target: &record.PaymentExpiresAt},
		&record.PaymentChannel,
		&record.Status,
		&record.Notes,
		(*jsonRaw)(&record.Metadata),
		&record.PaymentConfirmSource,
		&record.PaidAmountIDR,
		&sqlNullTimeTarget{target: &record.PaidAt},
		&record.CreatedAt,
		&record.UpdatedAt,
	)
	if err != nil {
		return Order{}, fmt.Errorf("insert billing order: %w", err)
	}

	if status == "paid" {
		if err := s.activateOrderSubscription(ctx, tx, tenantID, planID, billingCycleDays, totalAmountIDR); err != nil {
			return Order{}, err
		}
	}

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO audit_logs (tenant_id, actor_user_id, action, target_type, target_id, metadata)
		VALUES (
			$1,
			NULLIF($2, '')::uuid,
			'billing.order_created',
			'billing_order',
			$3,
			jsonb_build_object(
				'plan_code', $4::text,
				'billing_cycle', $5::text,
				'coupon_code', $6::text,
				'total_amount_idr', $7::bigint,
				'payment_amount_idr', $8::bigint,
				'status', $9::text
			)
		)
	`, tenantID, actorUserID, record.ID, planCode, billingCycle, couponCode, totalAmountIDR, paymentAmountIDR, status); err != nil {
		return Order{}, fmt.Errorf("insert billing order audit log: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return Order{}, fmt.Errorf("commit billing order tx: %w", err)
	}

	return record, nil
}

func (s *Service) ListTenantOrders(ctx context.Context, tenantID string, limit int) ([]Order, error) {
	if limit <= 0 || limit > 100 {
		limit = 25
	}
	rows, err := s.db.QueryContext(ctx, `
		SELECT
			id,
			tenant_id,
			'' AS tenant_name,
			plan_code,
			plan_name,
			billing_cycle,
			billing_cycle_days,
			base_amount_idr,
			coupon_code,
			discount_type,
			discount_value,
			discount_amount_idr,
			total_amount_idr,
			unique_amount_idr,
			payment_amount_idr,
			payment_reference,
			payment_expires_at,
			payment_channel,
			status,
			notes,
			metadata,
			payment_confirm_source,
			paid_amount_idr,
			paid_at,
			created_at,
			updated_at
		FROM billing_orders
		WHERE tenant_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`, tenantID, limit)
	if err != nil {
		return nil, fmt.Errorf("list tenant billing orders: %w", err)
	}
	defer rows.Close()

	return scanOrders(rows)
}

func (s *Service) ListPlatformOrders(ctx context.Context, limit int) ([]Order, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	rows, err := s.db.QueryContext(ctx, `
		SELECT
			o.id,
			o.tenant_id,
			t.name AS tenant_name,
			o.plan_code,
			o.plan_name,
			o.billing_cycle,
			o.billing_cycle_days,
			o.base_amount_idr,
			o.coupon_code,
			o.discount_type,
			o.discount_value,
			o.discount_amount_idr,
			o.total_amount_idr,
			o.unique_amount_idr,
			o.payment_amount_idr,
			o.payment_reference,
			o.payment_expires_at,
			o.payment_channel,
			o.status,
			o.notes,
			o.metadata,
			o.payment_confirm_source,
			o.paid_amount_idr,
			o.paid_at,
			o.created_at,
			o.updated_at
		FROM billing_orders o
		INNER JOIN tenants t ON t.id = o.tenant_id
		ORDER BY o.created_at DESC
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, fmt.Errorf("list platform billing orders: %w", err)
	}
	defer rows.Close()

	return scanOrders(rows)
}

func (s *Service) UpdateOrderStatus(ctx context.Context, orderID string, input OrderStatusInput) (Order, error) {
	orderID = strings.TrimSpace(orderID)
	status := strings.TrimSpace(strings.ToLower(input.Status))
	if orderID == "" || status == "" {
		return Order{}, fmt.Errorf("billing order status validation failed")
	}
	switch status {
	case "pending_payment", "waiting_confirmation", "paid", "rejected", "canceled", "expired":
	default:
		return Order{}, fmt.Errorf("billing order status is invalid")
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return Order{}, fmt.Errorf("begin billing status update tx: %w", err)
	}
	defer tx.Rollback()

	record, err := s.updateOrderStatusTx(ctx, tx, orderID, input, "", time.Now().UTC())
	if err != nil {
		return Order{}, err
	}

	if err := tx.Commit(); err != nil {
		return Order{}, fmt.Errorf("commit billing status update tx: %w", err)
	}

	return record, nil
}

func (s *Service) updateOrderStatusTx(ctx context.Context, tx *sql.Tx, orderID string, input OrderStatusInput, matchedNotificationID string, effectivePaidAt time.Time) (Order, error) {
	var (
		tenantID         string
		planID           string
		billingCycleDays int
		totalAmountIDR   int64
		paymentAmountIDR int64
		currentStatus    string
	)
	if err := tx.QueryRowContext(ctx, `
		SELECT tenant_id, plan_id, billing_cycle_days, total_amount_idr, payment_amount_idr, status
		FROM billing_orders
		WHERE id = $1
		LIMIT 1
	`, orderID).Scan(&tenantID, &planID, &billingCycleDays, &totalAmountIDR, &paymentAmountIDR, &currentStatus); err != nil {
		return Order{}, fmt.Errorf("load billing order for update: %w", err)
	}

	status := strings.TrimSpace(strings.ToLower(input.Status))
	confirmSource := strings.TrimSpace(input.ConfirmSource)
	if status == "paid" && confirmSource == "" {
		confirmSource = "platform_admin"
	}

	paidAmountIDR := input.PaidAmountIDR
	if status == "paid" && paidAmountIDR <= 0 {
		paidAmountIDR = paymentAmountIDR
		if paidAmountIDR <= 0 {
			paidAmountIDR = totalAmountIDR
		}
	}

	if currentStatus != "paid" && status == "paid" {
		if err := s.activateOrderSubscription(ctx, tx, tenantID, planID, billingCycleDays, totalAmountIDR); err != nil {
			return Order{}, err
		}
	}

	if _, err := tx.ExecContext(ctx, `
		UPDATE billing_orders
		SET status = $2,
			notes = CASE WHEN $3 <> '' THEN $3 ELSE notes END,
			payment_confirm_source = CASE WHEN $2 = 'paid' THEN $4 ELSE payment_confirm_source END,
			paid_amount_idr = CASE WHEN $2 = 'paid' THEN $5 ELSE paid_amount_idr END,
			matched_notification_id = CASE WHEN NULLIF($6, '') IS NOT NULL THEN $6::uuid ELSE matched_notification_id END,
			paid_at = CASE WHEN $2 = 'paid' THEN COALESCE(paid_at, $7) ELSE paid_at END,
			updated_at = NOW()
		WHERE id = $1
	`, orderID, status, strings.TrimSpace(input.Notes), confirmSource, paidAmountIDR, matchedNotificationID, effectivePaidAt); err != nil {
		return Order{}, fmt.Errorf("update billing order status: %w", err)
	}

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO audit_logs (tenant_id, actor_user_id, action, target_type, target_id, metadata)
		VALUES (
			$1,
			NULL,
			'billing.order_status_updated',
			'billing_order',
			$2,
			jsonb_build_object(
				'status', $3::text,
				'confirm_source', $4::text,
				'paid_amount_idr', $5::bigint
			)
		)
	`, tenantID, orderID, status, confirmSource, paidAmountIDR); err != nil {
		return Order{}, fmt.Errorf("insert billing status audit log: %w", err)
	}

	row := tx.QueryRowContext(ctx, `
		SELECT
			o.id,
			o.tenant_id,
			t.name AS tenant_name,
			o.plan_code,
			o.plan_name,
			o.billing_cycle,
			o.billing_cycle_days,
			o.base_amount_idr,
			o.coupon_code,
			o.discount_type,
			o.discount_value,
			o.discount_amount_idr,
			o.total_amount_idr,
			o.unique_amount_idr,
			o.payment_amount_idr,
			o.payment_reference,
			o.payment_expires_at,
			o.payment_channel,
			o.status,
			o.notes,
			o.metadata,
			o.payment_confirm_source,
			o.paid_amount_idr,
			o.paid_at,
			o.created_at,
			o.updated_at
		FROM billing_orders o
		INNER JOIN tenants t ON t.id = o.tenant_id
		WHERE o.id = $1
		LIMIT 1
	`, orderID)
	record, err := scanOrder(row)
	if err != nil {
		return Order{}, err
	}

	return record, nil
}

func (s *Service) activateOrderSubscription(ctx context.Context, tx *sql.Tx, tenantID string, planID string, billingCycleDays int, totalAmountIDR int64) error {
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO tenant_subscriptions (
			tenant_id,
			plan_id,
			status,
			source,
			custom_monthly_price_idr,
			current_period_start,
			current_period_end
		)
		VALUES (
			$1,
			$2,
			'active',
			'manual',
			CASE WHEN $4 > 0 AND $3 <= 31 THEN $4 ELSE NULL END,
			NOW(),
			CASE WHEN $3 > 0 THEN NOW() + (($3 || ' days')::interval) ELSE NULL END
		)
	`, tenantID, planID, billingCycleDays, totalAmountIDR); err != nil {
		return fmt.Errorf("activate tenant subscription from billing order: %w", err)
	}
	return nil
}

func (s *Service) resolveCoupon(ctx context.Context, tx *sql.Tx, couponCode string, planCode string, baseAmountIDR int64) (string, int64, int64, error) {
	var (
		resourceKey string
		status      string
		configRaw   []byte
	)
	if err := tx.QueryRowContext(ctx, `
		SELECT resource_key, status, config
		FROM platform_resource_items
		WHERE resource_type = 'coupon'
		  AND (
			UPPER(resource_key) = $1
			OR UPPER(name) = $1
		  )
		ORDER BY created_at DESC
		LIMIT 1
	`, couponCode).Scan(&resourceKey, &status, &configRaw); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", 0, 0, fmt.Errorf("coupon tidak ditemukan")
		}
		return "", 0, 0, fmt.Errorf("load coupon: %w", err)
	}
	if strings.ToLower(strings.TrimSpace(status)) != "active" {
		return "", 0, 0, fmt.Errorf("coupon sedang tidak aktif")
	}

	config := map[string]any{}
	if len(configRaw) > 0 {
		if err := json.Unmarshal(configRaw, &config); err != nil {
			return "", 0, 0, fmt.Errorf("parse coupon config: %w", err)
		}
	}

	appliesTo := strings.ToLower(strings.TrimSpace(stringValue(config["applies_to"])))
	if appliesTo != "" && appliesTo != "all" {
		allowed := false
		for _, part := range strings.Split(appliesTo, ",") {
			if strings.TrimSpace(strings.ToLower(part)) == planCode {
				allowed = true
				break
			}
		}
		if !allowed {
			return "", 0, 0, fmt.Errorf("coupon tidak berlaku untuk paket ini")
		}
	}

	maxRedemptions := int64(numberValue(config["max_redemptions"]))
	if maxRedemptions > 0 {
		var totalUsed int64
		if err := tx.QueryRowContext(ctx, `
			SELECT COUNT(*)
			FROM billing_orders
			WHERE UPPER(coupon_code) = $1
			  AND status IN ('pending_payment', 'waiting_confirmation', 'paid')
		`, couponCode).Scan(&totalUsed); err != nil {
			return "", 0, 0, fmt.Errorf("count coupon redemptions: %w", err)
		}
		if totalUsed >= maxRedemptions {
			return "", 0, 0, fmt.Errorf("coupon sudah mencapai batas penggunaan")
		}
	}

	discountType := strings.ToLower(strings.TrimSpace(stringValue(config["discount_type"])))
	discountValue := int64(numberValue(config["discount_value"]))
	if discountType == "" {
		discountType = strings.ToLower(strings.TrimSpace(stringValue(config["type"])))
	}
	if discountValue <= 0 {
		return "", 0, 0, fmt.Errorf("coupon belum memiliki nilai diskon")
	}

	var discountAmountIDR int64
	switch discountType {
	case "percent":
		if discountValue > 100 {
			discountValue = 100
		}
		discountAmountIDR = baseAmountIDR * discountValue / 100
	case "fixed":
		discountAmountIDR = discountValue
	default:
		return "", 0, 0, fmt.Errorf("coupon memiliki tipe diskon yang belum didukung")
	}

	maxDiscountIDR := int64(numberValue(config["max_discount_idr"]))
	if maxDiscountIDR > 0 && discountAmountIDR > maxDiscountIDR {
		discountAmountIDR = maxDiscountIDR
	}
	if discountAmountIDR > baseAmountIDR {
		discountAmountIDR = baseAmountIDR
	}

	if resourceKey == "" {
		resourceKey = couponCode
	}

	return discountType, discountValue, discountAmountIDR, nil
}

func scanOrders(rows *sql.Rows) ([]Order, error) {
	result := make([]Order, 0, 16)
	for rows.Next() {
		record, err := scanOrder(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, record)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate billing orders: %w", err)
	}
	return result, nil
}

type orderScanner interface {
	Scan(dest ...any) error
}

func scanOrder(scanner orderScanner) (Order, error) {
	record := Order{}
	if err := scanner.Scan(
		&record.ID,
		&record.TenantID,
		&record.TenantName,
		&record.PlanCode,
		&record.PlanName,
		&record.BillingCycle,
		&record.BillingCycleDays,
		&record.BaseAmountIDR,
		&record.CouponCode,
		&record.DiscountType,
		&record.DiscountValue,
		&record.DiscountAmountIDR,
		&record.TotalAmountIDR,
		&record.UniqueAmountIDR,
		&record.PaymentAmountIDR,
		&record.PaymentReference,
		&sqlNullTimeTarget{target: &record.PaymentExpiresAt},
		&record.PaymentChannel,
		&record.Status,
		&record.Notes,
		(*jsonRaw)(&record.Metadata),
		&record.PaymentConfirmSource,
		&record.PaidAmountIDR,
		&sqlNullTimeTarget{target: &record.PaidAt},
		&record.CreatedAt,
		&record.UpdatedAt,
	); err != nil {
		return Order{}, fmt.Errorf("scan billing order: %w", err)
	}
	return record, nil
}

type jsonRaw map[string]any

func (j *jsonRaw) Scan(value any) error {
	if value == nil {
		*j = map[string]any{}
		return nil
	}
	raw, ok := value.([]byte)
	if !ok {
		return fmt.Errorf("unsupported json raw type %T", value)
	}
	config := map[string]any{}
	if len(raw) > 0 {
		if err := json.Unmarshal(raw, &config); err != nil {
			return err
		}
	}
	*j = config
	return nil
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

func stringValue(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	default:
		return ""
	}
}

func numberValue(value any) float64 {
	switch typed := value.(type) {
	case float64:
		return typed
	case float32:
		return float64(typed)
	case int:
		return float64(typed)
	case int64:
		return float64(typed)
	default:
		return 0
	}
}
