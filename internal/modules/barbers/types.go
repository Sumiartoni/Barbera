package barbers

import "time"

type Barber struct {
	ID              string     `json:"id"`
	TenantID        string     `json:"tenant_id"`
	FullName        string     `json:"full_name"`
	PhoneNumber     string     `json:"phone_number"`
	Status          string     `json:"status"`
	IsBookable      bool       `json:"is_bookable"`
	SortOrder       int        `json:"sort_order"`
	OnShift         bool       `json:"on_shift"`
	CurrentShiftEnd *time.Time `json:"current_shift_end,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

type CreateInput struct {
	FullName    string `json:"full_name"`
	PhoneNumber string `json:"phone_number"`
	SortOrder   int    `json:"sort_order"`
	IsBookable  *bool  `json:"is_bookable"`
	Status      string `json:"status"`
}

type UpdateInput struct {
	FullName    string `json:"full_name"`
	PhoneNumber string `json:"phone_number"`
	SortOrder   int    `json:"sort_order"`
	IsBookable  *bool  `json:"is_bookable"`
	Status      string `json:"status"`
}

type ListOptions struct {
	At time.Time
}
