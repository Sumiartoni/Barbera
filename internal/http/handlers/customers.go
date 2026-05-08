package handlers

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"balikcukur/internal/http/middleware"
	"balikcukur/internal/modules/customers"
	"balikcukur/pkg/httpx"
)

type CustomersHandler struct {
	service *customers.Service
}

func NewCustomersHandler(service *customers.Service) *CustomersHandler {
	return &CustomersHandler{service: service}
}

func (h *CustomersHandler) List(w http.ResponseWriter, r *http.Request) {
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

	result, err := h.service.List(ctx, claims.TenantID, customers.ListFilters{
		Query: r.URL.Query().Get("q"),
		Limit: limit,
	})
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "customers_failed", "Gagal memuat daftar pelanggan.")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"customers": result,
	})
}

func (h *CustomersHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.AuthClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "Session tenant tidak valid.")
		return
	}

	var input customers.CreateInput
	if err := httpx.DecodeJSON(r, &input); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_json", "Payload JSON tidak valid.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	record, err := h.service.Create(ctx, claims.TenantID, input)
	if err != nil {
		switch {
		case errors.Is(err, customers.ErrValidation):
			httpx.WriteError(w, http.StatusBadRequest, "validation_failed", "Nama pelanggan dan nomor WhatsApp wajib diisi.")
		case errors.Is(err, customers.ErrPhoneInUse):
			httpx.WriteError(w, http.StatusConflict, "phone_already_used", "Nomor pelanggan sudah terdaftar.")
		default:
			httpx.WriteError(w, http.StatusInternalServerError, "customer_create_failed", "Gagal menambahkan pelanggan.")
		}
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, record)
}

func (h *CustomersHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.AuthClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "Session tenant tidak valid.")
		return
	}

	customerID := strings.TrimSpace(r.PathValue("customerID"))
	if customerID == "" {
		httpx.WriteError(w, http.StatusBadRequest, "missing_customer_id", "Customer ID wajib diisi.")
		return
	}

	var input customers.UpdateInput
	if err := httpx.DecodeJSON(r, &input); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_json", "Payload JSON tidak valid.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	record, err := h.service.Update(ctx, claims.TenantID, customerID, input)
	if err != nil {
		switch {
		case errors.Is(err, customers.ErrValidation):
			httpx.WriteError(w, http.StatusBadRequest, "validation_failed", "Nama pelanggan dan nomor WhatsApp wajib diisi.")
		case errors.Is(err, customers.ErrPhoneInUse):
			httpx.WriteError(w, http.StatusConflict, "phone_already_used", "Nomor pelanggan sudah terdaftar.")
		case errors.Is(err, customers.ErrCustomerAbsent):
			httpx.WriteError(w, http.StatusNotFound, "customer_not_found", "Pelanggan tidak ditemukan.")
		default:
			httpx.WriteError(w, http.StatusInternalServerError, "customer_update_failed", "Gagal memperbarui pelanggan.")
		}
		return
	}

	httpx.WriteJSON(w, http.StatusOK, record)
}
