package ownercommands

import "errors"

var (
	ErrValidation = errors.New("validation failed")
	ErrForbidden  = errors.New("forbidden")
)
