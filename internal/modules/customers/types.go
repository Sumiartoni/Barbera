package customers

import "time"

type Customer struct {
	ID                  string     `json:"id"`
	TenantID            string     `json:"tenant_id"`
	FullName            string     `json:"full_name"`
	PhoneNumber         string     `json:"phone_number"`
	PreferredBarberID   string     `json:"preferred_barber_id,omitempty"`
	PreferredBarberName string     `json:"preferred_barber_name,omitempty"`
	PreferredBarber     string     `json:"preferred_barber"`
	Notes               string     `json:"notes"`
	LastVisitAt         *time.Time `json:"last_visit_at,omitempty"`
	TotalVisits         int        `json:"total_visits"`
	TotalSpentIDR       int64      `json:"total_spent_idr"`
	CreatedAt           time.Time  `json:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at"`
}

type ListFilters struct {
	Query string
	Limit int
}

type CreateInput struct {
	FullName          string `json:"full_name"`
	PhoneNumber       string `json:"phone_number"`
	PreferredBarberID string `json:"preferred_barber_id"`
	PreferredBarber   string `json:"preferred_barber"`
	Notes             string `json:"notes"`
}

type UpdateInput struct {
	FullName          string `json:"full_name"`
	PhoneNumber       string `json:"phone_number"`
	PreferredBarberID string `json:"preferred_barber_id"`
	PreferredBarber   string `json:"preferred_barber"`
	Notes             string `json:"notes"`
}
