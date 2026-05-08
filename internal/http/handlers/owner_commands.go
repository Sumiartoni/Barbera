package handlers

import (
	"context"
	"errors"
	"net/http"
	"time"

	"balikcukur/internal/http/middleware"
	"balikcukur/internal/modules/barbers"
	"balikcukur/internal/modules/ownercommands"
	"balikcukur/internal/modules/shifts"
	"balikcukur/pkg/httpx"
)

type OwnerCommandsHandler struct {
	service *ownercommands.Service
}

type executeShiftCommandRequest struct {
	Command string `json:"command"`
}

func NewOwnerCommandsHandler(service *ownercommands.Service) *OwnerCommandsHandler {
	return &OwnerCommandsHandler{service: service}
}

func (h *OwnerCommandsHandler) ExecuteShiftCommand(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.AuthClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "Session tenant tidak valid.")
		return
	}

	var input executeShiftCommandRequest
	if err := httpx.DecodeJSON(r, &input); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_json", "Payload JSON tidak valid.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	result, err := h.service.Execute(ctx, claims.TenantID, ownercommands.ExecuteInput{
		Command:       input.Command,
		ActorRole:     claims.Role,
		ActorUserID:   claims.UserID,
		ActorFullName: "",
	})
	if err != nil {
		switch {
		case errors.Is(err, ownercommands.ErrValidation):
			httpx.WriteError(w, http.StatusBadRequest, "validation_failed", "Format command shift tidak valid. Gunakan SHIFT HELP untuk melihat contoh.")
		case errors.Is(err, ownercommands.ErrForbidden):
			httpx.WriteError(w, http.StatusForbidden, "forbidden", "Hanya owner atau admin yang bisa mengatur shift via command.")
		case errors.Is(err, barbers.ErrNotFound):
			httpx.WriteError(w, http.StatusNotFound, "barber_not_found", "Barber pada command tidak ditemukan.")
		case errors.Is(err, shifts.ErrOverlapShift):
			httpx.WriteError(w, http.StatusConflict, "shift_overlap", "Shift baru bentrok dengan jadwal barber yang sudah ada.")
		default:
			httpx.WriteError(w, http.StatusInternalServerError, "command_failed", "Gagal memproses command shift.")
		}
		return
	}

	httpx.WriteJSON(w, http.StatusOK, result)
}
