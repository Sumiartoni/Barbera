package outlets

import "errors"

var (
	ErrValidation        = errors.New("outlets: validation failed")
	ErrPlanLimitExceeded = errors.New("outlets: plan limit exceeded")
)
