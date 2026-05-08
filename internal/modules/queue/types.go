package queue

import "time"

type Ticket struct {
	ID                   string     `json:"id"`
	TenantID             string     `json:"tenant_id"`
	CustomerID           string     `json:"customer_id"`
	CustomerName         string     `json:"customer_name"`
	QueueNumber          int        `json:"queue_number"`
	QueueDate            string     `json:"queue_date"`
	ServiceSummary       string     `json:"service_summary"`
	PreferredBarberID    string     `json:"preferred_barber_id,omitempty"`
	PreferredBarber      string     `json:"preferred_barber,omitempty"`
	AssignedBarberID     string     `json:"assigned_barber_id,omitempty"`
	AssignedBarber       string     `json:"assigned_barber,omitempty"`
	StationID            string     `json:"station_id,omitempty"`
	StationName          string     `json:"station_name,omitempty"`
	Status               string     `json:"status"`
	Source               string     `json:"source"`
	Notes                string     `json:"notes"`
	EstimatedWaitMinutes int        `json:"estimated_wait_minutes"`
	RequestedAt          time.Time  `json:"requested_at"`
	ScheduledFor         *time.Time `json:"scheduled_for,omitempty"`
}

type CreateInput struct {
	CustomerID        string     `json:"customer_id"`
	PreferredBarberID string     `json:"preferred_barber_id"`
	AssignedBarberID  string     `json:"assigned_barber_id"`
	StationID         string     `json:"station_id"`
	Source            string     `json:"source"`
	ServiceSummary    string     `json:"service_summary"`
	Notes             string     `json:"notes"`
	ScheduledFor      *time.Time `json:"scheduled_for"`
	CreatedByUserID   string     `json:"created_by_user_id"`
}

type UpdateStatusInput struct {
	Status           string `json:"status"`
	AssignedBarberID string `json:"assigned_barber_id"`
	StationID        string `json:"station_id"`
}

type PublicQueueView struct {
	TenantID       string         `json:"tenant_id"`
	TenantName     string         `json:"tenant_name"`
	PublicQueueID  string         `json:"public_queue_id"`
	PublicQueueURL string         `json:"public_queue_url"`
	BarbersOnShift int            `json:"barbers_on_shift"`
	ActiveStations int            `json:"active_stations"`
	WaitingCount   int            `json:"waiting_count"`
	InServiceCount int            `json:"in_service_count"`
	UpdatedAt      time.Time      `json:"updated_at"`
	Tickets        []PublicTicket `json:"tickets"`
}

type PublicTicket struct {
	ID                   string     `json:"id"`
	QueueNumber          int        `json:"queue_number"`
	CustomerName         string     `json:"customer_name"`
	ServiceSummary       string     `json:"service_summary"`
	Status               string     `json:"status"`
	AssignedBarber       string     `json:"assigned_barber"`
	StationName          string     `json:"station_name"`
	EstimatedWaitMinutes int        `json:"estimated_wait_minutes"`
	RequestedAt          time.Time  `json:"requested_at"`
	ScheduledFor         *time.Time `json:"scheduled_for,omitempty"`
}
