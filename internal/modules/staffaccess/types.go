package staffaccess

import "time"

type Account struct {
	ID          string     `json:"id"`
	TenantID    string     `json:"tenant_id"`
	BarberID    string     `json:"barber_id"`
	BarberName  string     `json:"barber_name"`
	Role        string     `json:"role"`
	AccessCode  string     `json:"access_code"`
	Status      string     `json:"status"`
	LastLoginAt *time.Time `json:"last_login_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

type ProvisionInput struct {
	BarberID       string `json:"barber_id"`
	PIN            string `json:"pin"`
	RegenerateCode bool   `json:"regenerate_code"`
}

type UpdateInput struct {
	PIN            string `json:"pin"`
	Status         string `json:"status"`
	RegenerateCode bool   `json:"regenerate_code"`
}

type LoginInput struct {
	AccessCode string `json:"access_code"`
	PIN        string `json:"pin"`
}

type Session struct {
	AccessToken string       `json:"access_token"`
	TokenType   string       `json:"token_type"`
	ExpiresAt   time.Time    `json:"expires_at"`
	Staff       StaffSummary `json:"staff"`
	Tenant      TenantInfo   `json:"tenant"`
}

type StaffSummary struct {
	ID         string `json:"id"`
	BarberID   string `json:"barber_id"`
	FullName   string `json:"full_name"`
	Role       string `json:"role"`
	AccessCode string `json:"access_code"`
}

type TenantInfo struct {
	ID             string `json:"id"`
	Slug           string `json:"slug"`
	Name           string `json:"name"`
	PublicQueueID  string `json:"public_queue_id"`
	PublicQueueURL string `json:"public_queue_url"`
}
