package shifts

import "errors"

var (
	ErrValidation   = errors.New("validation failed")
	ErrOverlapShift = errors.New("shift overlap")
	ErrBarberMiss   = errors.New("barber not found")
	ErrShiftMissing = errors.New("shift not found")
)
