package auth

import "time"

type RegisterInput struct {
	BarbershopName string `json:"barbershop_name"`
	FullName       string `json:"full_name"`
	Email          string `json:"email"`
	PhoneNumber    string `json:"phone_number"`
	Password       string `json:"password"`
}

type LoginInput struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type AuthResult struct {
	AccessToken string        `json:"access_token"`
	TokenType   string        `json:"token_type"`
	ExpiresAt   time.Time     `json:"expires_at"`
	User        UserSummary   `json:"user"`
	Tenant      TenantSummary `json:"tenant"`
	PlanCode    string        `json:"plan_code"`
}

type UserSummary struct {
	ID          string `json:"id"`
	Email       string `json:"email"`
	FullName    string `json:"full_name"`
	PhoneNumber string `json:"phone_number"`
	Role        string `json:"role"`
}

type TenantSummary struct {
	ID            string `json:"id"`
	Slug          string `json:"slug"`
	Name          string `json:"name"`
	PublicQueueID string `json:"public_queue_id"`
}

type AuthClaims struct {
	UserID    string
	TenantID  string
	Role      string
	ActorType string
	ExpiresAt time.Time
}

type AuthProfile struct {
	User     UserSummary   `json:"user"`
	Tenant   TenantSummary `json:"tenant"`
	PlanCode string        `json:"plan_code"`
}
