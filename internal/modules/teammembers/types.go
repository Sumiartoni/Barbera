package teammembers

import "time"

type Member struct {
	MembershipID string     `json:"membership_id"`
	UserID       string     `json:"user_id"`
	Email        string     `json:"email"`
	FullName     string     `json:"full_name"`
	PhoneNumber  string     `json:"phone_number"`
	Role         string     `json:"role"`
	Status       string     `json:"status"`
	IsPrimary    bool       `json:"is_primary"`
	LastLoginAt  *time.Time `json:"last_login_at,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

type CreateInput struct {
	Email       string `json:"email"`
	FullName    string `json:"full_name"`
	PhoneNumber string `json:"phone_number"`
	Password    string `json:"password"`
	Role        string `json:"role"`
}

type UpdateInput struct {
	FullName    string `json:"full_name"`
	PhoneNumber string `json:"phone_number"`
	Role        string `json:"role"`
	Status      string `json:"status"`
	Password    string `json:"password"`
}
