package staffaccess

import "errors"

var (
	ErrValidation        = errors.New("staff access validation failed")
	ErrBarberNotFound    = errors.New("barber not found")
	ErrCredentialInvalid = errors.New("invalid staff credential")
	ErrAccessDisabled    = errors.New("staff access disabled")
)
