package handlers

import (
	"context"
	"net/http"
	"time"

	"balikcukur/internal/http/middleware"
	"balikcukur/internal/modules/reports"
	"balikcukur/pkg/httpx"
)

type DashboardHandler struct {
	service *reports.Service
}

func NewDashboardHandler(service *reports.Service) *DashboardHandler {
	return &DashboardHandler{service: service}
}

func (h *DashboardHandler) Summary(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.AuthClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "Session tenant tidak valid.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	summary, err := h.service.DashboardSummary(ctx, claims.TenantID)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "dashboard_failed", "Gagal memuat ringkasan dashboard.")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, summary)
}
