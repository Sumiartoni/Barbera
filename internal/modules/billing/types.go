package billing

import "time"

type Summary struct {
	PlanCode             string     `json:"plan_code"`
	PlanName             string     `json:"plan_name"`
	IsFree               bool       `json:"is_free"`
	MonthlyPriceIDR      int64      `json:"monthly_price_idr"`
	YearlyPriceIDR       int64      `json:"yearly_price_idr"`
	BillingCycleDays     int        `json:"billing_cycle_days"`
	CurrentPeriodEnd     *time.Time `json:"current_period_end,omitempty"`
	MaxOutlets           int        `json:"max_outlets"`
	MaxUsers             int        `json:"max_users"`
	MaxCustomers         int        `json:"max_customers"`
	MaxRemindersPerMonth int        `json:"max_reminders_per_month"`
	MaxWhatsAppSessions  int        `json:"max_whatsapp_sessions"`
	AllowCampaigns       bool       `json:"allow_campaigns"`
	AllowLoyalty         bool       `json:"allow_loyalty"`
	AllowExports         bool       `json:"allow_exports"`
	AllowMultiOutlet     bool       `json:"allow_multi_outlet"`
}

type CatalogPlan struct {
	Code                 string `json:"code"`
	Name                 string `json:"name"`
	Description          string `json:"description"`
	IsFree               bool   `json:"is_free"`
	MonthlyPriceIDR      int64  `json:"monthly_price_idr"`
	YearlyPriceIDR       int64  `json:"yearly_price_idr"`
	BillingCycleDays     int    `json:"billing_cycle_days"`
	MaxOutlets           int    `json:"max_outlets"`
	MaxUsers             int    `json:"max_users"`
	MaxCustomers         int    `json:"max_customers"`
	MaxRemindersPerMonth int    `json:"max_reminders_per_month"`
	MaxWhatsAppSessions  int    `json:"max_whatsapp_sessions"`
	AllowCampaigns       bool   `json:"allow_campaigns"`
	AllowLoyalty         bool   `json:"allow_loyalty"`
	AllowExports         bool   `json:"allow_exports"`
	AllowMultiOutlet     bool   `json:"allow_multi_outlet"`
}

type CreateOrderInput struct {
	PlanCode       string `json:"plan_code"`
	BillingCycle   string `json:"billing_cycle"`
	CouponCode     string `json:"coupon_code"`
	PaymentChannel string `json:"payment_channel"`
	Notes          string `json:"notes"`
}

type Order struct {
	ID                string         `json:"id"`
	TenantID          string         `json:"tenant_id"`
	TenantName        string         `json:"tenant_name,omitempty"`
	PlanCode          string         `json:"plan_code"`
	PlanName          string         `json:"plan_name"`
	BillingCycle      string         `json:"billing_cycle"`
	BillingCycleDays  int            `json:"billing_cycle_days"`
	BaseAmountIDR     int64          `json:"base_amount_idr"`
	CouponCode        string         `json:"coupon_code"`
	DiscountType      string         `json:"discount_type"`
	DiscountValue     int64          `json:"discount_value"`
	DiscountAmountIDR int64          `json:"discount_amount_idr"`
	TotalAmountIDR    int64          `json:"total_amount_idr"`
	UniqueAmountIDR   int64          `json:"unique_amount_idr"`
	PaymentAmountIDR  int64          `json:"payment_amount_idr"`
	PaymentReference  string         `json:"payment_reference"`
	PaymentChannel    string         `json:"payment_channel"`
	Status            string         `json:"status"`
	Notes             string         `json:"notes"`
	Metadata          map[string]any `json:"metadata"`
	PaymentExpiresAt  *time.Time     `json:"payment_expires_at,omitempty"`
	PaymentConfirmSource string      `json:"payment_confirm_source"`
	PaidAmountIDR     int64          `json:"paid_amount_idr"`
	PaidAt            *time.Time     `json:"paid_at,omitempty"`
	CreatedAt         time.Time      `json:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at"`
}

type OrderStatusInput struct {
	Status           string `json:"status"`
	Notes            string `json:"notes"`
	PaidAmountIDR    int64  `json:"paid_amount_idr"`
	ConfirmSource    string `json:"confirm_source"`
}

type ForwarderNotificationInput struct {
	Secret    string         `json:"secret"`
	AppName   string         `json:"app_name"`
	Title     string         `json:"title"`
	Message   string         `json:"message"`
	Sender    string         `json:"sender"`
	AmountIDR int64          `json:"amount_idr"`
	ReceivedAt string        `json:"received_at"`
	RawPayload map[string]any `json:"raw_payload"`
}

type ForwarderNotificationResult struct {
	NotificationID string `json:"notification_id"`
	MatchStatus    string `json:"match_status"`
	OrderID        string `json:"order_id,omitempty"`
	OrderStatus    string `json:"order_status,omitempty"`
	PaymentAmountIDR int64 `json:"payment_amount_idr,omitempty"`
	Message        string `json:"message"`
}
