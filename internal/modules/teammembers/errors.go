package teammembers

import "errors"

var (
	ErrValidation     = errors.New("team member validation failed")
	ErrMemberNotFound = errors.New("team member not found")
	ErrEmailUsed      = errors.New("team member email already used")
	ErrPrimaryOwner   = errors.New("primary owner cannot be modified")
)
