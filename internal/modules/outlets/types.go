package outlets

import "time"

type Outlet struct {
	ID          string    `json:"id"`
	TenantID    string    `json:"tenant_id"`
	Name        string    `json:"name"`
	Code        string    `json:"code"`
	Address     string    `json:"address"`
	PhoneNumber string    `json:"phone_number"`
	Status      string    `json:"status"`
	IsPrimary   bool      `json:"is_primary"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type CreateInput struct {
	Name        string `json:"name"`
	Code        string `json:"code"`
	Address     string `json:"address"`
	PhoneNumber string `json:"phone_number"`
	IsPrimary   bool   `json:"is_primary"`
	Status      string `json:"status"`
}

type UpdateInput struct {
	Name        string `json:"name"`
	Code        string `json:"code"`
	Address     string `json:"address"`
	PhoneNumber string `json:"phone_number"`
	Status      string `json:"status"`
}

type Entitlement struct {
	PlanCode         string `json:"plan_code"`
	MaxOutlets       int    `json:"max_outlets"`
	CurrentOutlets   int    `json:"current_outlets"`
	AllowMultiOutlet bool   `json:"allow_multi_outlet"`
	CanCreateMore    bool   `json:"can_create_more"`
}
