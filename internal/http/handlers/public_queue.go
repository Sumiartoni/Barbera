package handlers

import (
	"context"
	"errors"
	"net/http"
	"time"

	"balikcukur/internal/modules/queue"
	"balikcukur/pkg/httpx"
)

type PublicQueueHandler struct {
	service *queue.Service
}

func NewPublicQueueHandler(service *queue.Service) *PublicQueueHandler {
	return &PublicQueueHandler{service: service}
}

func (h *PublicQueueHandler) Show(w http.ResponseWriter, r *http.Request) {
	publicQueueID := r.PathValue("publicQueueID")
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	view, err := h.service.PublicView(ctx, publicQueueID)
	if err != nil {
		switch {
		case errors.Is(err, queue.ErrValidation):
			httpx.WriteError(w, http.StatusBadRequest, "validation_failed", "ID antrean publik tidak valid.")
		case errors.Is(err, queue.ErrMissingRef):
			httpx.WriteError(w, http.StatusNotFound, "queue_not_found", "Antrean publik tidak ditemukan.")
		default:
			httpx.WriteError(w, http.StatusInternalServerError, "public_queue_failed", "Gagal memuat antrean publik.")
		}
		return
	}

	httpx.WriteJSON(w, http.StatusOK, view)
}
