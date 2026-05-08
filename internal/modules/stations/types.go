package stations

import "time"

type Station struct {
	ID        string    `json:"id"`
	TenantID  string    `json:"tenant_id"`
	Name      string    `json:"name"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type CreateInput struct {
	Name   string `json:"name"`
	Status string `json:"status"`
}

type UpdateInput struct {
	Name   string `json:"name"`
	Status string `json:"status"`
}
