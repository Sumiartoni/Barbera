package resources

import "errors"

var (
	ErrValidation         = errors.New("resources: validation failed")
	ErrNotFound           = errors.New("resources: not found")
	ErrFeatureUnavailable = errors.New("resources: feature unavailable for current plan")
)
