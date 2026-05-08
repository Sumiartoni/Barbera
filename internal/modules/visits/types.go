package visits

import "time"

type Visit struct {
	ID             string     `json:"id"`
	TenantID       string     `json:"tenant_id"`
	CustomerID     string     `json:"customer_id"`
	QueueTicketID  string     `json:"queue_ticket_id,omitempty"`
	CustomerName   string     `json:"customer_name"`
	PhoneNumber    string     `json:"phone_number"`
	ServiceName    string     `json:"service_name"`
	BarberID       string     `json:"barber_id,omitempty"`
	BarberName     string     `json:"barber_name"`
	StationID      string     `json:"station_id,omitempty"`
	StationName    string     `json:"station_name,omitempty"`
	AmountIDR      int64      `json:"amount_idr"`
	PaymentStatus  string     `json:"payment_status"`
	Notes          string     `json:"notes"`
	VisitAt        time.Time  `json:"visit_at"`
	NextReminderAt *time.Time `json:"next_reminder_at,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
}

type CreateInput struct {
	CustomerID    string     `json:"customer_id"`
	QueueTicketID string     `json:"queue_ticket_id"`
	ServiceName   string     `json:"service_name"`
	BarberID      string     `json:"barber_id"`
	BarberName    string     `json:"barber_name"`
	StationID     string     `json:"station_id"`
	AmountIDR     int64      `json:"amount_idr"`
	PaymentStatus string     `json:"payment_status"`
	Notes         string     `json:"notes"`
	VisitAt       *time.Time `json:"visit_at"`
	ReminderDays  int        `json:"reminder_days"`
}
