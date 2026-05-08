package handlers

import (
	"context"
	"errors"
	"net/http"
	"time"

	"balikcukur/internal/http/middleware"
	"balikcukur/internal/modules/shifts"
	"balikcukur/pkg/httpx"
)

type ShiftsHandler struct {
	service *shifts.Service
}

func NewShiftsHandler(service *shifts.Service) *ShiftsHandler {
	return &ShiftsHandler{service: service}
}

func (h *ShiftsHandler) List(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.AuthClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "Session tenant tidak valid.")
		return
	}

	day := time.Now().In(jakartaLocation())
	if raw := r.URL.Query().Get("day"); raw != "" {
		parsed, err := time.ParseInLocation("2006-01-02", raw, jakartaLocation())
		if err != nil {
			httpx.WriteError(w, http.StatusBadRequest, "invalid_day", "Parameter day harus berformat YYYY-MM-DD.")
			return
		}
		day = parsed
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	result, err := h.service.List(ctx, claims.TenantID, day)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "shifts_failed", "Gagal memuat shift barber.")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"day":    day.Format("2006-01-02"),
		"shifts": result,
	})
}

func (h *ShiftsHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.AuthClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "Session tenant tidak valid.")
		return
	}

	var input shifts.CreateInput
	if err := httpx.DecodeJSON(r, &input); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_json", "Payload JSON tidak valid.")
		return
	}
	input.CreatedByUserID = claims.UserID
	if input.Source == "" {
		input.Source = "dashboard"
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	record, err := h.service.Create(ctx, claims.TenantID, input)
	if err != nil {
		switch {
		case errors.Is(err, shifts.ErrValidation):
			httpx.WriteError(w, http.StatusBadRequest, "validation_failed", "barber_id, starts_at, dan ends_at wajib valid.")
		case errors.Is(err, shifts.ErrBarberMiss):
			httpx.WriteError(w, http.StatusNotFound, "barber_not_found", "Barber tidak ditemukan.")
		case errors.Is(err, shifts.ErrOverlapShift):
			httpx.WriteError(w, http.StatusConflict, "shift_overlap", "Shift barber bentrok dengan jadwal lain.")
		default:
			httpx.WriteError(w, http.StatusInternalServerError, "shift_create_failed", "Gagal menambahkan shift.")
		}
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, record)
}

func (h *ShiftsHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.AuthClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "Session tenant tidak valid.")
		return
	}

	var input shifts.UpdateInput
	if err := httpx.DecodeJSON(r, &input); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_json", "Payload JSON tidak valid.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	record, err := h.service.Update(ctx, claims.TenantID, r.PathValue("shiftID"), input)
	if err != nil {
		switch {
		case errors.Is(err, shifts.ErrValidation):
			httpx.WriteError(w, http.StatusBadRequest, "validation_failed", "Data shift tidak valid.")
		case errors.Is(err, shifts.ErrBarberMiss):
			httpx.WriteError(w, http.StatusNotFound, "barber_not_found", "Barber tidak ditemukan.")
		case errors.Is(err, shifts.ErrShiftMissing):
			httpx.WriteError(w, http.StatusNotFound, "shift_not_found", "Shift tidak ditemukan.")
		case errors.Is(err, shifts.ErrOverlapShift):
			httpx.WriteError(w, http.StatusConflict, "shift_overlap", "Shift barber bentrok dengan jadwal lain.")
		default:
			httpx.WriteError(w, http.StatusInternalServerError, "shift_update_failed", "Gagal memperbarui shift.")
		}
		return
	}

	httpx.WriteJSON(w, http.StatusOK, record)
}

func jakartaLocation() *time.Location {
	location, err := time.LoadLocation("Asia/Jakarta")
	if err != nil {
		return time.FixedZone("WIB", 7*60*60)
	}
	return location
}
