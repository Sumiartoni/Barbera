package handlers

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"balikcukur/internal/http/middleware"
	"balikcukur/internal/modules/stations"
	"balikcukur/pkg/httpx"
)

type StationsHandler struct {
	service *stations.Service
}

func NewStationsHandler(service *stations.Service) *StationsHandler {
	return &StationsHandler{service: service}
}

func (h *StationsHandler) List(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.AuthClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "Session tenant tidak valid.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	result, err := h.service.List(ctx, claims.TenantID)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "stations_failed", "Gagal memuat daftar kursi.")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{"stations": result})
}

func (h *StationsHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.AuthClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "Session tenant tidak valid.")
		return
	}

	var input stations.CreateInput
	if err := httpx.DecodeJSON(r, &input); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_json", "Payload JSON tidak valid.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	record, err := h.service.Create(ctx, claims.TenantID, input)
	if err != nil {
		switch {
		case errors.Is(err, stations.ErrValidation):
			httpx.WriteError(w, http.StatusBadRequest, "validation_failed", "Nama kursi wajib diisi.")
		default:
			httpx.WriteError(w, http.StatusInternalServerError, "station_create_failed", "Gagal menambahkan kursi.")
		}
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, record)
}

func (h *StationsHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.AuthClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "Session tenant tidak valid.")
		return
	}

	stationID := strings.TrimSpace(r.PathValue("stationID"))
	if stationID == "" {
		httpx.WriteError(w, http.StatusBadRequest, "missing_station_id", "Station ID wajib diisi.")
		return
	}

	var input stations.UpdateInput
	if err := httpx.DecodeJSON(r, &input); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_json", "Payload JSON tidak valid.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	record, err := h.service.Update(ctx, claims.TenantID, stationID, input)
	if err != nil {
		switch {
		case errors.Is(err, stations.ErrValidation):
			httpx.WriteError(w, http.StatusBadRequest, "validation_failed", "Nama kursi wajib diisi.")
		default:
			httpx.WriteError(w, http.StatusInternalServerError, "station_update_failed", "Gagal memperbarui kursi.")
		}
		return
	}

	httpx.WriteJSON(w, http.StatusOK, record)
}
