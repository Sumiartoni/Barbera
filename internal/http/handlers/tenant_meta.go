package handlers

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"time"

	"balikcukur/internal/http/middleware"
	"balikcukur/internal/modules/audit"
	"balikcukur/internal/modules/billing"
	"balikcukur/internal/modules/usage"
	"balikcukur/pkg/httpx"
)

type BillingHandler struct {
	service *billing.Service
}

func NewBillingHandler(service *billing.Service) *BillingHandler {
	return &BillingHandler{service: service}
}

func (h *BillingHandler) Summary(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.AuthClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "Session tenant tidak valid.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	result, err := h.service.GetSummary(ctx, claims.TenantID)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "billing_summary_failed", "Gagal memuat billing tenant.")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, result)
}

func (h *BillingHandler) Catalog(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	items, err := h.service.ListCatalog(ctx)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "billing_catalog_failed", "Gagal memuat katalog paket.")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{"plans": items})
}

func (h *BillingHandler) ListOrders(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.AuthClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "Session tenant tidak valid.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	items, err := h.service.ListTenantOrders(ctx, claims.TenantID, 50)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "billing_orders_failed", "Gagal memuat order pembelian paket.")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{"orders": items})
}

func (h *BillingHandler) CreateOrder(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.AuthClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "Session tenant tidak valid.")
		return
	}

	var input billing.CreateOrderInput
	if err := httpx.DecodeJSON(r, &input); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_json", "Payload JSON tidak valid.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	order, err := h.service.CreateOrder(ctx, claims.TenantID, claims.UserID, input)
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "billing_order_create_failed", err.Error())
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, order)
}

func (h *BillingHandler) PublicManualQRISForwarder(w http.ResponseWriter, r *http.Request) {
	var input billing.ForwarderNotificationInput
	if err := httpx.DecodeJSON(r, &input); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_json", "Payload JSON tidak valid.")
		return
	}

	if strings.TrimSpace(input.Secret) == "" {
		input.Secret = strings.TrimSpace(r.Header.Get("X-Barbera-Forwarder-Secret"))
	}
	if input.RawPayload == nil {
		input.RawPayload = map[string]any{
			"forwarded_from": strings.TrimSpace(r.UserAgent()),
		}
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	result, err := h.service.ProcessForwarderNotification(ctx, input)
	if err != nil {
		statusCode := http.StatusBadRequest
		if strings.Contains(strings.ToLower(err.Error()), "secret") {
			statusCode = http.StatusUnauthorized
		}
		httpx.WriteError(w, statusCode, "manual_qris_forwarder_failed", err.Error())
		return
	}

	httpx.WriteJSON(w, http.StatusOK, result)
}

type UsageHandler struct {
	service *usage.Service
}

func NewUsageHandler(service *usage.Service) *UsageHandler {
	return &UsageHandler{service: service}
}

func (h *UsageHandler) Summary(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.AuthClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "Session tenant tidak valid.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	result, err := h.service.Summary(ctx, claims.TenantID)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "usage_summary_failed", "Gagal memuat usage tenant.")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, result)
}

type TenantAuditLogsHandler struct {
	service *audit.Service
}

func NewTenantAuditLogsHandler(service *audit.Service) *TenantAuditLogsHandler {
	return &TenantAuditLogsHandler{service: service}
}

func (h *TenantAuditLogsHandler) List(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.AuthClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "Session tenant tidak valid.")
		return
	}

	limit := 25
	if raw := strings.TrimSpace(r.URL.Query().Get("limit")); raw != "" {
		if value, err := strconv.Atoi(raw); err == nil && value > 0 {
			limit = value
		}
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	result, err := h.service.ListTenantLogs(ctx, claims.TenantID, limit)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "tenant_audit_logs_failed", "Gagal memuat audit log tenant.")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{"audit_logs": result})
}
