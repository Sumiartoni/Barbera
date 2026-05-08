package handlers

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"balikcukur/internal/modules/resources"
	"balikcukur/pkg/httpx"
)

type PlatformResourcesHandler struct {
	service *resources.Service
}

func NewPlatformResourcesHandler(service *resources.Service) *PlatformResourcesHandler {
	return &PlatformResourcesHandler{service: service}
}

func (h *PlatformResourcesHandler) List(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	items, err := h.service.ListPlatformItems(ctx, strings.TrimSpace(r.PathValue("resourceType")))
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "platform_resources_failed", "Gagal memuat resource platform.")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *PlatformResourcesHandler) Create(w http.ResponseWriter, r *http.Request) {
	var input resources.ResourceInput
	if err := httpx.DecodeJSON(r, &input); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_json", "Payload JSON tidak valid.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	item, err := h.service.CreatePlatformItem(ctx, strings.TrimSpace(r.PathValue("resourceType")), input)
	if err != nil {
		if errors.Is(err, resources.ErrValidation) {
			httpx.WriteError(w, http.StatusBadRequest, "validation_failed", "Nama resource wajib diisi.")
			return
		}
		httpx.WriteError(w, http.StatusInternalServerError, "platform_resource_create_failed", "Gagal membuat resource platform.")
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, item)
}

func (h *PlatformResourcesHandler) Update(w http.ResponseWriter, r *http.Request) {
	var input resources.ResourceInput
	if err := httpx.DecodeJSON(r, &input); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_json", "Payload JSON tidak valid.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	item, err := h.service.UpdatePlatformItem(ctx, strings.TrimSpace(r.PathValue("resourceType")), strings.TrimSpace(r.PathValue("itemID")), input)
	if err != nil {
		switch {
		case errors.Is(err, resources.ErrValidation):
			httpx.WriteError(w, http.StatusBadRequest, "validation_failed", "Nama resource wajib diisi.")
		case errors.Is(err, resources.ErrNotFound):
			httpx.WriteError(w, http.StatusNotFound, "not_found", "Resource platform tidak ditemukan.")
		default:
			httpx.WriteError(w, http.StatusInternalServerError, "platform_resource_update_failed", "Gagal memperbarui resource platform.")
		}
		return
	}

	httpx.WriteJSON(w, http.StatusOK, item)
}

func (h *PlatformResourcesHandler) Delete(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	err := h.service.DeletePlatformItem(ctx, strings.TrimSpace(r.PathValue("resourceType")), strings.TrimSpace(r.PathValue("itemID")))
	if err != nil {
		switch {
		case errors.Is(err, resources.ErrNotFound):
			httpx.WriteError(w, http.StatusNotFound, "not_found", "Resource platform tidak ditemukan.")
		default:
			httpx.WriteError(w, http.StatusInternalServerError, "platform_resource_delete_failed", "Gagal menghapus resource platform.")
		}
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{"ok": true})
}

type PlatformConfigHandler struct {
	service *resources.Service
}

func NewPlatformConfigHandler(service *resources.Service) *PlatformConfigHandler {
	return &PlatformConfigHandler{service: service}
}

func (h *PlatformConfigHandler) Get(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	config, err := h.service.GetPlatformConfig(ctx, strings.TrimSpace(r.PathValue("configType")))
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "platform_config_failed", "Gagal memuat konfigurasi platform.")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{"config": config})
}

func (h *PlatformConfigHandler) Put(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Config map[string]any `json:"config"`
	}
	if err := httpx.DecodeJSON(r, &body); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_json", "Payload JSON tidak valid.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	config, err := h.service.PutPlatformConfig(ctx, strings.TrimSpace(r.PathValue("configType")), body.Config)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "platform_config_update_failed", "Gagal menyimpan konfigurasi platform.")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{"config": config})
}
