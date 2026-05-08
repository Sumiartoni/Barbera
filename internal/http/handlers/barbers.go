package handlers

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"balikcukur/internal/http/middleware"
	"balikcukur/internal/modules/barbers"
	"balikcukur/pkg/httpx"
)

type BarbersHandler struct {
	service *barbers.Service
}

func NewBarbersHandler(service *barbers.Service) *BarbersHandler {
	return &BarbersHandler{service: service}
}

func (h *BarbersHandler) List(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.AuthClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "Session tenant tidak valid.")
		return
	}

	var at time.Time
	if raw := r.URL.Query().Get("at"); raw != "" {
		parsed, err := time.Parse(time.RFC3339, raw)
		if err != nil {
			httpx.WriteError(w, http.StatusBadRequest, "invalid_at", "Parameter at harus berformat RFC3339.")
			return
		}
		at = parsed
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	result, err := h.service.List(ctx, claims.TenantID, barbers.ListOptions{At: at})
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "barbers_failed", "Gagal memuat daftar barber.")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{"barbers": result})
}

func (h *BarbersHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.AuthClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "Session tenant tidak valid.")
		return
	}

	var input barbers.CreateInput
	if err := httpx.DecodeJSON(r, &input); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_json", "Payload JSON tidak valid.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	record, err := h.service.Create(ctx, claims.TenantID, input)
	if err != nil {
		switch {
		case errors.Is(err, barbers.ErrValidation):
			httpx.WriteError(w, http.StatusBadRequest, "validation_failed", "Nama barber wajib diisi.")
		default:
			httpx.WriteError(w, http.StatusInternalServerError, "barber_create_failed", "Gagal menambahkan barber.")
		}
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, record)
}

func (h *BarbersHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.AuthClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "Session tenant tidak valid.")
		return
	}

	barberID := strings.TrimSpace(r.PathValue("barberID"))
	if barberID == "" {
		httpx.WriteError(w, http.StatusBadRequest, "missing_barber_id", "Barber ID wajib diisi.")
		return
	}

	var input barbers.UpdateInput
	if err := httpx.DecodeJSON(r, &input); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_json", "Payload JSON tidak valid.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	record, err := h.service.Update(ctx, claims.TenantID, barberID, input)
	if err != nil {
		switch {
		case errors.Is(err, barbers.ErrValidation):
			httpx.WriteError(w, http.StatusBadRequest, "validation_failed", "Nama barber wajib diisi.")
		case errors.Is(err, barbers.ErrNotFound):
			httpx.WriteError(w, http.StatusNotFound, "barber_not_found", "Barber tidak ditemukan.")
		default:
			httpx.WriteError(w, http.StatusInternalServerError, "barber_update_failed", "Gagal memperbarui barber.")
		}
		return
	}

	httpx.WriteJSON(w, http.StatusOK, record)
}
