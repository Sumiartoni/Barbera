package platform

import "time"

type Overview struct {
	Stats      OverviewStats   `json:"stats"`
	Tenants    []TenantSummary `json:"tenants"`
	RecentLogs []AuditEntry    `json:"recent_logs"`
}

type OverviewStats struct {
	TotalTenants       int   `json:"total_tenants"`
	PaidTenants        int   `json:"paid_tenants"`
	FreeTenants        int   `json:"free_tenants"`
	EstimatedMRRIDR    int64 `json:"estimated_mrr_idr"`
	TotalOutlets       int   `json:"total_outlets"`
	TotalCustomers     int   `json:"total_customers"`
	TotalVisits30d     int   `json:"total_visits_30d"`
	PendingReminders7d int   `json:"pending_reminders_7d"`
}

type TenantSummary struct {
	ID               string     `json:"id"`
	Name             string     `json:"name"`
	Slug             string     `json:"slug"`
	Status           string     `json:"status"`
	PlanCode         string     `json:"plan_code"`
	Outlets          int        `json:"outlets"`
	Customers        int        `json:"customers"`
	Barbers          int        `json:"barbers"`
	Stations         int        `json:"stations"`
	Visits30d        int        `json:"visits_30d"`
	Revenue30dIDR    int64      `json:"revenue_30d_idr"`
	PublicQueueID    string     `json:"public_queue_id"`
	CreatedAt        time.Time  `json:"created_at"`
	CurrentPeriodEnd *time.Time `json:"current_period_end,omitempty"`
}

type AuditEntry struct {
	ID         string    `json:"id"`
	TenantID   string    `json:"tenant_id"`
	Action     string    `json:"action"`
	TargetType string    `json:"target_type"`
	TargetID   string    `json:"target_id"`
	CreatedAt  time.Time `json:"created_at"`
}

type SystemStatus struct {
	Database          string    `json:"database"`
	LastCheckedAt     time.Time `json:"last_checked_at"`
	TotalQueueWaiting int       `json:"total_queue_waiting"`
	TotalQueueServing int       `json:"total_queue_serving"`
	ActiveStations    int       `json:"active_stations"`
	BarbersOnShift    int       `json:"barbers_on_shift"`
}
