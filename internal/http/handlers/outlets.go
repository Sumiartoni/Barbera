package handlers

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"balikcukur/internal/http/middleware"
	"balikcukur/internal/modules/outlets"
	"balikcukur/pkg/httpx"
)

type OutletsHandler struct {
	service *outlets.Service
}

func NewOutletsHandler(service *outlets.Service) *OutletsHandler {
	return &OutletsHandler{service: service}
}

func (h *OutletsHandler) List(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.AuthClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "Session tenant tidak valid.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	items, entitlement, err := h.service.List(ctx, claims.TenantID)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "outlets_failed", "Gagal memuat outlet tenant.")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"outlets":     items,
		"entitlement": entitlement,
	})
}

func (h *OutletsHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.AuthClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "Session tenant tidak valid.")
		return
	}

	var input outlets.CreateInput
	if err := httpx.DecodeJSON(r, &input); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_json", "Payload JSON tidak valid.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	record, entitlement, err := h.service.Create(ctx, claims.TenantID, input)
	if err != nil {
		switch {
		case errors.Is(err, outlets.ErrValidation):
			httpx.WriteError(w, http.StatusBadRequest, "validation_failed", "Nama outlet wajib diisi.")
		case errors.Is(err, outlets.ErrPlanLimitExceeded):
			httpx.WriteError(
				w,
				http.StatusForbidden,
				"plan_limit_exceeded",
				"Batas outlet pada paket saat ini sudah tercapai. Upgrade paket untuk menambah cabang.",
			)
		default:
			httpx.WriteError(w, http.StatusInternalServerError, "outlet_create_failed", "Gagal menambahkan outlet.")
		}
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, map[string]any{
		"outlet":      record,
		"entitlement": entitlement,
	})
}

func (h *OutletsHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.AuthClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "Session tenant tidak valid.")
		return
	}

	outletID := strings.TrimSpace(r.PathValue("outletID"))
	if outletID == "" {
		httpx.WriteError(w, http.StatusBadRequest, "missing_outlet_id", "Outlet ID wajib diisi.")
		return
	}

	var input outlets.UpdateInput
	if err := httpx.DecodeJSON(r, &input); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_json", "Payload JSON tidak valid.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	record, err := h.service.Update(ctx, claims.TenantID, outletID, input)
	if err != nil {
		switch {
		case errors.Is(err, outlets.ErrValidation):
			httpx.WriteError(w, http.StatusBadRequest, "validation_failed", "Nama outlet wajib diisi.")
		default:
			httpx.WriteError(w, http.StatusInternalServerError, "outlet_update_failed", "Gagal memperbarui outlet.")
		}
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"outlet": record,
	})
}
