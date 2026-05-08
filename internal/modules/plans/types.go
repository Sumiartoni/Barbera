package plans

type PublicPlan struct {
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

type UpdatePlanInput struct {
	Name                 string `json:"name"`
	Description          string `json:"description"`
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
