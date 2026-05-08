package handlers

import (
	"context"
	"errors"
	"net/http"
	"time"

	"balikcukur/internal/http/middleware"
	"balikcukur/internal/modules/queue"
	"balikcukur/pkg/httpx"
)

type QueueHandler struct {
	service *queue.Service
}

func NewQueueHandler(service *queue.Service) *QueueHandler {
	return &QueueHandler{service: service}
}

func (h *QueueHandler) ListActive(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.AuthClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "Session tenant tidak valid.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	result, err := h.service.ListActive(ctx, claims.TenantID)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "queue_failed", "Gagal memuat antrean aktif.")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{"tickets": result})
}

func (h *QueueHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.AuthClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "Session tenant tidak valid.")
		return
	}

	var input queue.CreateInput
	if err := httpx.DecodeJSON(r, &input); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_json", "Payload JSON tidak valid.")
		return
	}
	if claims.ActorType == "user" {
		input.CreatedByUserID = claims.UserID
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	record, err := h.service.Create(ctx, claims.TenantID, input)
	if err != nil {
		switch {
		case errors.Is(err, queue.ErrValidation):
			httpx.WriteError(w, http.StatusBadRequest, "validation_failed", "customer_id wajib diisi.")
		case errors.Is(err, queue.ErrMissingRef):
			httpx.WriteError(w, http.StatusNotFound, "reference_not_found", "Customer atau barber pilihan tidak ditemukan.")
		default:
			httpx.WriteError(w, http.StatusInternalServerError, "queue_create_failed", "Gagal menambahkan antrean.")
		}
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, record)
}

func (h *QueueHandler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.AuthClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "Session tenant tidak valid.")
		return
	}

	var input queue.UpdateStatusInput
	if err := httpx.DecodeJSON(r, &input); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_json", "Payload JSON tidak valid.")
		return
	}

	actorUserID := ""
	if claims.ActorType == "user" {
		actorUserID = claims.UserID
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	record, err := h.service.UpdateStatus(ctx, claims.TenantID, r.PathValue("ticketID"), actorUserID, input)
	if err != nil {
		switch {
		case errors.Is(err, queue.ErrValidation):
			httpx.WriteError(w, http.StatusBadRequest, "validation_failed", "Status antrean atau referensi barber/kursi tidak valid.")
		case errors.Is(err, queue.ErrMissingRef):
			httpx.WriteError(w, http.StatusNotFound, "queue_not_found", "Antrean, barber, atau kursi tidak ditemukan.")
		default:
			httpx.WriteError(w, http.StatusInternalServerError, "queue_status_failed", "Gagal memperbarui status antrean.")
		}
		return
	}

	httpx.WriteJSON(w, http.StatusOK, record)
}
