package handlers

import (
	"context"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"balikcukur/internal/modules/billing"
	"balikcukur/internal/modules/plans"
	"balikcukur/internal/modules/platform"
	"balikcukur/pkg/httpx"
)

type PlatformHandler struct {
	service      *platform.Service
	plansService *plans.Service
	billing      *billing.Service
}

func NewPlatformHandler(service *platform.Service, plansService *plans.Service, billingService *billing.Service) *PlatformHandler {
	return &PlatformHandler{
		service:      service,
		plansService: plansService,
		billing:      billingService,
	}
}

func (h *PlatformHandler) Overview(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	result, err := h.service.Overview(ctx)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "platform_overview_failed", "Gagal memuat ringkasan platform.")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, result)
}

func (h *PlatformHandler) Tenants(w http.ResponseWriter, r *http.Request) {
	limit, err := strconv.Atoi(strings.TrimSpace(r.URL.Query().Get("limit")))
	if err != nil && strings.TrimSpace(r.URL.Query().Get("limit")) != "" {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_limit", "Parameter limit tidak valid.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	tenants, err := h.service.ListTenants(ctx, limit)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "platform_tenants_failed", "Gagal memuat tenant platform.")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{"tenants": tenants})
}

func (h *PlatformHandler) Plans(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	result, err := h.plansService.ListPublic(ctx)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "platform_plans_failed", "Gagal memuat paket platform.")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{"plans": result})
}

func (h *PlatformHandler) SystemStatus(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	status, err := h.service.SystemStatus(ctx)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "platform_status_failed", "Gagal memuat status sistem.")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, status)
}

func (h *PlatformHandler) AuditLogs(w http.ResponseWriter, r *http.Request) {
	limit, err := strconv.Atoi(strings.TrimSpace(r.URL.Query().Get("limit")))
	if err != nil && strings.TrimSpace(r.URL.Query().Get("limit")) != "" {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_limit", "Parameter limit tidak valid.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	logs, err := h.service.ListAuditLogs(ctx, limit)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "platform_audit_failed", "Gagal memuat audit log.")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{"audit_logs": logs})
}

func (h *PlatformHandler) AssignTenantPlan(w http.ResponseWriter, r *http.Request) {
	tenantID := strings.TrimSpace(r.PathValue("tenantID"))
	if tenantID == "" {
		httpx.WriteError(w, http.StatusBadRequest, "missing_tenant_id", "Tenant ID wajib diisi.")
		return
	}

	var input struct {
		PlanCode string `json:"plan_code"`
	}
	if err := httpx.DecodeJSON(r, &input); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_json", "Payload JSON tidak valid.")
		return
	}

	if strings.TrimSpace(input.PlanCode) == "" {
		httpx.WriteError(w, http.StatusBadRequest, "missing_plan_code", "Plan code wajib diisi.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	if err := h.service.AssignTenantPlan(ctx, tenantID, strings.TrimSpace(input.PlanCode)); err != nil {
		log.Printf("platform assign tenant plan failed tenant=%s plan=%s err=%v", tenantID, input.PlanCode, err)
		httpx.WriteError(w, http.StatusInternalServerError, "assign_plan_failed", "Gagal memperbarui paket tenant.")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"ok":        true,
		"tenant_id": tenantID,
		"plan_code": strings.TrimSpace(input.PlanCode),
	})
}

func (h *PlatformHandler) UpdateTenantStatus(w http.ResponseWriter, r *http.Request) {
	tenantID := strings.TrimSpace(r.PathValue("tenantID"))
	if tenantID == "" {
		httpx.WriteError(w, http.StatusBadRequest, "missing_tenant_id", "Tenant ID wajib diisi.")
		return
	}

	var input struct {
		Status string `json:"status"`
	}
	if err := httpx.DecodeJSON(r, &input); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_json", "Payload JSON tidak valid.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	if err := h.service.UpdateTenantStatus(ctx, tenantID, strings.TrimSpace(input.Status)); err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "tenant_status_update_failed", "Gagal memperbarui status tenant.")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"ok":        true,
		"tenant_id": tenantID,
		"status":    strings.TrimSpace(input.Status),
	})
}

func (h *PlatformHandler) UpdatePlan(w http.ResponseWriter, r *http.Request) {
	planCode := strings.TrimSpace(r.PathValue("planCode"))
	if planCode == "" {
		httpx.WriteError(w, http.StatusBadRequest, "missing_plan_code", "Plan code wajib diisi.")
		return
	}

	var input plans.UpdatePlanInput
	if err := httpx.DecodeJSON(r, &input); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_json", "Payload JSON tidak valid.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	item, err := h.plansService.Update(ctx, planCode, input)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "plan_update_failed", "Gagal memperbarui paket.")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, item)
}

func (h *PlatformHandler) BillingOrders(w http.ResponseWriter, r *http.Request) {
	limit, err := strconv.Atoi(strings.TrimSpace(r.URL.Query().Get("limit")))
	if err != nil && strings.TrimSpace(r.URL.Query().Get("limit")) != "" {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_limit", "Parameter limit tidak valid.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	items, err := h.billing.ListPlatformOrders(ctx, limit)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "platform_billing_orders_failed", "Gagal memuat order pembelian paket.")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{"orders": items})
}

func (h *PlatformHandler) UpdateBillingOrderStatus(w http.ResponseWriter, r *http.Request) {
	orderID := strings.TrimSpace(r.PathValue("orderID"))
	if orderID == "" {
		httpx.WriteError(w, http.StatusBadRequest, "missing_order_id", "Order ID wajib diisi.")
		return
	}

	var input billing.OrderStatusInput
	if err := httpx.DecodeJSON(r, &input); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_json", "Payload JSON tidak valid.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	item, err := h.billing.UpdateOrderStatus(ctx, orderID, input)
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "billing_order_update_failed", err.Error())
		return
	}

	httpx.WriteJSON(w, http.StatusOK, item)
}
