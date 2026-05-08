package handlers

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"balikcukur/internal/http/middleware"
	"balikcukur/internal/modules/resources"
	"balikcukur/pkg/httpx"
)

type TenantResourcesHandler struct {
	service *resources.Service
}

func NewTenantResourcesHandler(service *resources.Service) *TenantResourcesHandler {
	return &TenantResourcesHandler{service: service}
}

func (h *TenantResourcesHandler) List(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.AuthClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "Session tenant tidak valid.")
		return
	}

	resourceType := strings.TrimSpace(r.PathValue("resourceType"))
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	items, err := h.service.ListTenantItems(ctx, claims.TenantID, resourceType)
	if err != nil {
		if errors.Is(err, resources.ErrFeatureUnavailable) {
			httpx.WriteError(w, http.StatusForbidden, "feature_unavailable", "Fitur ini belum tersedia untuk paket tenant saat ini.")
			return
		}
		httpx.WriteError(w, http.StatusInternalServerError, "tenant_resources_failed", "Gagal memuat resource tenant.")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *TenantResourcesHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.AuthClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "Session tenant tidak valid.")
		return
	}

	var input resources.ResourceInput
	if err := httpx.DecodeJSON(r, &input); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_json", "Payload JSON tidak valid.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	item, err := h.service.CreateTenantItem(ctx, claims.TenantID, strings.TrimSpace(r.PathValue("resourceType")), input)
	if err != nil {
		if errors.Is(err, resources.ErrValidation) {
			httpx.WriteError(w, http.StatusBadRequest, "validation_failed", "Nama resource wajib diisi.")
			return
		}
		if errors.Is(err, resources.ErrFeatureUnavailable) {
			httpx.WriteError(w, http.StatusForbidden, "feature_unavailable", "Fitur ini belum tersedia untuk paket tenant saat ini.")
			return
		}
		httpx.WriteError(w, http.StatusInternalServerError, "tenant_resource_create_failed", "Gagal membuat resource tenant.")
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, item)
}

func (h *TenantResourcesHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.AuthClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "Session tenant tidak valid.")
		return
	}

	var input resources.ResourceInput
	if err := httpx.DecodeJSON(r, &input); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_json", "Payload JSON tidak valid.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	item, err := h.service.UpdateTenantItem(ctx, claims.TenantID, strings.TrimSpace(r.PathValue("resourceType")), strings.TrimSpace(r.PathValue("itemID")), input)
	if err != nil {
		switch {
		case errors.Is(err, resources.ErrValidation):
			httpx.WriteError(w, http.StatusBadRequest, "validation_failed", "Nama resource wajib diisi.")
		case errors.Is(err, resources.ErrFeatureUnavailable):
			httpx.WriteError(w, http.StatusForbidden, "feature_unavailable", "Fitur ini belum tersedia untuk paket tenant saat ini.")
		case errors.Is(err, resources.ErrNotFound):
			httpx.WriteError(w, http.StatusNotFound, "not_found", "Resource tenant tidak ditemukan.")
		default:
			httpx.WriteError(w, http.StatusInternalServerError, "tenant_resource_update_failed", "Gagal memperbarui resource tenant.")
		}
		return
	}

	httpx.WriteJSON(w, http.StatusOK, item)
}

func (h *TenantResourcesHandler) Delete(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.AuthClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "Session tenant tidak valid.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	err := h.service.DeleteTenantItem(ctx, claims.TenantID, strings.TrimSpace(r.PathValue("resourceType")), strings.TrimSpace(r.PathValue("itemID")))
	if err != nil {
		switch {
		case errors.Is(err, resources.ErrFeatureUnavailable):
			httpx.WriteError(w, http.StatusForbidden, "feature_unavailable", "Fitur ini belum tersedia untuk paket tenant saat ini.")
		case errors.Is(err, resources.ErrNotFound):
			httpx.WriteError(w, http.StatusNotFound, "not_found", "Resource tenant tidak ditemukan.")
		default:
			httpx.WriteError(w, http.StatusInternalServerError, "tenant_resource_delete_failed", "Gagal menghapus resource tenant.")
		}
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{"ok": true})
}

type TenantConfigHandler struct {
	service *resources.Service
}

func NewTenantConfigHandler(service *resources.Service) *TenantConfigHandler {
	return &TenantConfigHandler{service: service}
}

func (h *TenantConfigHandler) Get(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.AuthClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "Session tenant tidak valid.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	config, err := h.service.GetTenantConfig(ctx, claims.TenantID, strings.TrimSpace(r.PathValue("configType")))
	if err != nil {
		if errors.Is(err, resources.ErrFeatureUnavailable) {
			httpx.WriteError(w, http.StatusForbidden, "feature_unavailable", "Fitur ini belum tersedia untuk paket tenant saat ini.")
			return
		}
		httpx.WriteError(w, http.StatusInternalServerError, "tenant_config_failed", "Gagal memuat konfigurasi tenant.")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{"config": config})
}

func (h *TenantConfigHandler) Put(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.AuthClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "Session tenant tidak valid.")
		return
	}

	var body struct {
		Config map[string]any `json:"config"`
	}
	if err := httpx.DecodeJSON(r, &body); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_json", "Payload JSON tidak valid.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	config, err := h.service.PutTenantConfig(ctx, claims.TenantID, strings.TrimSpace(r.PathValue("configType")), body.Config)
	if err != nil {
		if errors.Is(err, resources.ErrFeatureUnavailable) {
			httpx.WriteError(w, http.StatusForbidden, "feature_unavailable", "Fitur ini belum tersedia untuk paket tenant saat ini.")
			return
		}
		httpx.WriteError(w, http.StatusInternalServerError, "tenant_config_update_failed", "Gagal menyimpan konfigurasi tenant.")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{"config": config})
}
