package barbers

import "errors"

var (
	ErrValidation  = errors.New("validation failed")
	ErrNotFound    = errors.New("barber not found")
	ErrAlreadyUsed = errors.New("barber already exists")
)
