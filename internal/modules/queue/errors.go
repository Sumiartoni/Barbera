package queue

import "errors"

var (
	ErrValidation = errors.New("validation failed")
	ErrMissingRef = errors.New("missing reference")
)
