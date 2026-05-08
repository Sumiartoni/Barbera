package handlers

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"balikcukur/internal/http/middleware"
	"balikcukur/internal/modules/visits"
	"balikcukur/pkg/httpx"
)

type VisitsHandler struct {
	service *visits.Service
}

func NewVisitsHandler(service *visits.Service) *VisitsHandler {
	return &VisitsHandler{service: service}
}

func (h *VisitsHandler) List(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.AuthClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "Session tenant tidak valid.")
		return
	}

	limit, err := strconv.Atoi(strings.TrimSpace(r.URL.Query().Get("limit")))
	if err != nil && strings.TrimSpace(r.URL.Query().Get("limit")) != "" {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_limit", "Parameter limit tidak valid.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	result, err := h.service.ListRecent(ctx, claims.TenantID, limit)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "visits_failed", "Gagal memuat daftar kunjungan.")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"visits": result,
	})
}

func (h *VisitsHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.AuthClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "Session tenant tidak valid.")
		return
	}

	var input visits.CreateInput
	if err := httpx.DecodeJSON(r, &input); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_json", "Payload JSON tidak valid.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	actorUserID := ""
	if claims.ActorType == "user" {
		actorUserID = claims.UserID
	}

	record, err := h.service.Create(ctx, claims.TenantID, actorUserID, input)
	if err != nil {
		switch {
		case errors.Is(err, visits.ErrValidation):
			httpx.WriteError(w, http.StatusBadRequest, "validation_failed", "Customer, layanan, nominal, dan status pembayaran wajib valid.")
		case errors.Is(err, visits.ErrCustomerGone):
			httpx.WriteError(w, http.StatusNotFound, "customer_not_found", "Pelanggan tidak ditemukan di tenant ini.")
		default:
			httpx.WriteError(w, http.StatusInternalServerError, "visit_create_failed", "Gagal menyimpan kunjungan.")
		}
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, record)
}
