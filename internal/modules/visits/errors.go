package visits

import "errors"

var (
	ErrValidation   = errors.New("validation failed")
	ErrCustomerGone = errors.New("customer not found")
)
