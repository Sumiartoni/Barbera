package reports

import "time"

type DashboardSummary struct {
	Stats           DashboardStats      `json:"stats"`
	Setup           DashboardSetup      `json:"setup"`
	RecentCustomers []DashboardCustomer `json:"recent_customers"`
	RecentVisits    []DashboardVisit    `json:"recent_visits"`
}

type DashboardStats struct {
	TotalCustomers      int   `json:"total_customers"`
	ActiveCustomers30d  int   `json:"active_customers_30d"`
	DormantCustomers30d int   `json:"dormant_customers_30d"`
	Visits30d           int   `json:"visits_30d"`
	Revenue30dIDR       int64 `json:"revenue_30d_idr"`
	AverageTicket30dIDR int64 `json:"average_ticket_30d_idr"`
	UpcomingReminders7d int   `json:"upcoming_reminders_7d"`
	BarbersOnShiftNow   int   `json:"barbers_on_shift_now"`
	ActiveQueueTickets  int   `json:"active_queue_tickets"`
	ActiveStations      int   `json:"active_stations"`
}

type DashboardSetup struct {
	BarbersCount       int  `json:"barbers_count"`
	ServicesCount      int  `json:"services_count"`
	StationsCount      int  `json:"stations_count"`
	PrimaryOutletReady bool `json:"primary_outlet_ready"`
	WhatsAppConnected  bool `json:"whatsapp_connected"`
	PublicQueueEnabled bool `json:"public_queue_enabled"`
	SetupReadyScore    int  `json:"setup_ready_score"`
}

type DashboardCustomer struct {
	ID              string     `json:"id"`
	FullName        string     `json:"full_name"`
	PhoneNumber     string     `json:"phone_number"`
	PreferredBarber string     `json:"preferred_barber"`
	LastVisitAt     *time.Time `json:"last_visit_at,omitempty"`
	TotalVisits     int        `json:"total_visits"`
}

type DashboardVisit struct {
	ID             string     `json:"id"`
	CustomerID     string     `json:"customer_id"`
	CustomerName   string     `json:"customer_name"`
	ServiceName    string     `json:"service_name"`
	BarberName     string     `json:"barber_name"`
	AmountIDR      int64      `json:"amount_idr"`
	PaymentStatus  string     `json:"payment_status"`
	VisitAt        time.Time  `json:"visit_at"`
	NextReminderAt *time.Time `json:"next_reminder_at,omitempty"`
}
