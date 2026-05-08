package shifts

import "time"

type Shift struct {
	ID              string    `json:"id"`
	TenantID        string    `json:"tenant_id"`
	BarberID        string    `json:"barber_id"`
	BarberName      string    `json:"barber_name"`
	StartsAt        time.Time `json:"starts_at"`
	EndsAt          time.Time `json:"ends_at"`
	Source          string    `json:"source"`
	Status          string    `json:"status"`
	Notes           string    `json:"notes"`
	CreatedByUserID string    `json:"created_by_user_id"`
	CreatedAt       time.Time `json:"created_at"`
}

type CreateInput struct {
	BarberID        string    `json:"barber_id"`
	StartsAt        time.Time `json:"starts_at"`
	EndsAt          time.Time `json:"ends_at"`
	Notes           string    `json:"notes"`
	Status          string    `json:"status"`
	Source          string    `json:"source"`
	CreatedByUserID string    `json:"created_by_user_id"`
}

type UpdateInput struct {
	BarberID string    `json:"barber_id"`
	StartsAt time.Time `json:"starts_at"`
	EndsAt   time.Time `json:"ends_at"`
	Notes    string    `json:"notes"`
	Status   string    `json:"status"`
}
