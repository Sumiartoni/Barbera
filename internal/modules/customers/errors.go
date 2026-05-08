package customers

import "errors"

var (
	ErrValidation     = errors.New("validation failed")
	ErrPhoneInUse     = errors.New("phone already used")
	ErrCustomerAbsent = errors.New("customer not found")
)
