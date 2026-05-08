package handlers

import (
	"context"
	"net/http"
	"time"

	"balikcukur/internal/modules/plans"
	"balikcukur/pkg/httpx"
)

type PlansHandler struct {
	service *plans.Service
}

func NewPlansHandler(service *plans.Service) *PlansHandler {
	return &PlansHandler{service: service}
}

func (h *PlansHandler) ListPublic(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	records, err := h.service.ListPublic(ctx)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "failed_to_load_plans", "Gagal memuat daftar paket.")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"plans": records,
	})
}
