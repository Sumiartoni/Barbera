package auth

import "errors"

var (
	ErrValidation        = errors.New("validation failed")
	ErrEmailAlreadyUsed  = errors.New("email already used")
	ErrInvalidCredential = errors.New("invalid credentials")
	ErrFreePlanMissing   = errors.New("free plan is not configured")
)
