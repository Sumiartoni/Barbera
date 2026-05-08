package handlers

import (
	"context"
	"errors"
	"net/http"
	"time"

	"balikcukur/internal/http/middleware"
	"balikcukur/internal/modules/whatsapp"
	"balikcukur/pkg/httpx"
)

type WhatsAppHandler struct {
	service *whatsapp.Service
}

func NewWhatsAppHandler(service *whatsapp.Service) *WhatsAppHandler {
	return &WhatsAppHandler{service: service}
}

func (h *WhatsAppHandler) Overview(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.AuthClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "Session tenant tidak valid.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	result, err := h.service.Overview(ctx, claims.TenantID)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "whatsapp_overview_failed", "Gagal memuat modul WhatsApp.")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, result)
}

func (h *WhatsAppHandler) Execute(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.AuthClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "Session tenant tidak valid.")
		return
	}

	var input struct {
		Command   string `json:"command"`
		Source    string `json:"source"`
		ActorName string `json:"actor_name"`
	}
	if err := httpx.DecodeJSON(r, &input); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_json", "Payload JSON tidak valid.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	result, err := h.service.Execute(ctx, claims.TenantID, whatsapp.ExecuteInput{
		Command:     input.Command,
		ActorRole:   claims.Role,
		ActorUserID: claims.UserID,
		ActorName:   input.ActorName,
		Source:      input.Source,
	})
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "whatsapp_command_failed", err.Error())
		return
	}

	httpx.WriteJSON(w, http.StatusOK, result)
}

func (h *WhatsAppHandler) Logs(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.AuthClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "Session tenant tidak valid.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	items, err := h.service.ListLogs(ctx, claims.TenantID, 40)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "whatsapp_logs_failed", "Gagal memuat log command WhatsApp.")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{"logs": items})
}

func (h *WhatsAppHandler) PutConfig(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.AuthClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "Session tenant tidak valid.")
		return
	}

	var input whatsapp.Config
	if err := httpx.DecodeJSON(r, &input); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_json", "Payload JSON tidak valid.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	config, err := h.service.PutConfig(ctx, claims.TenantID, input)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "whatsapp_config_failed", "Gagal menyimpan konfigurasi WhatsApp.")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, config)
}

func (h *WhatsAppHandler) PublicOwnerCommand(w http.ResponseWriter, r *http.Request) {
	publicQueueID := r.PathValue("publicQueueID")
	if publicQueueID == "" {
		httpx.WriteError(w, http.StatusBadRequest, "missing_public_queue", "Public queue tenant wajib diisi.")
		return
	}

	var input whatsapp.ForwarderInput
	if err := httpx.DecodeJSON(r, &input); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_json", "Payload JSON tidak valid.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	result, err := h.service.ExecuteFromForwarder(ctx, publicQueueID, input)
	if err != nil {
		status := http.StatusBadRequest
		code := "whatsapp_forwarder_failed"
		if errors.Is(err, whatsapp.ErrForwarderUnauthorized) {
			status = http.StatusUnauthorized
			code = "whatsapp_forwarder_unauthorized"
		}
		httpx.WriteError(w, status, code, err.Error())
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"message": result.Message,
		"output":  result.Output,
		"action":  result.Action,
	})
}

func (h *WhatsAppHandler) PairPhone(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.AuthClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "Session tenant tidak valid.")
		return
	}

	var input whatsapp.PairPhoneInput
	if err := httpx.DecodeJSON(r, &input); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_json", "Payload JSON tidak valid.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 45*time.Second)
	defer cancel()

	state, err := h.service.PairPhone(ctx, claims.TenantID, input)
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "whatsapp_pair_phone_failed", err.Error())
		return
	}

	httpx.WriteJSON(w, http.StatusOK, state)
}

func (h *WhatsAppHandler) StartQRPairing(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.AuthClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "Session tenant tidak valid.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 45*time.Second)
	defer cancel()

	state, err := h.service.StartQRPairing(ctx, claims.TenantID)
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "whatsapp_pair_qr_failed", err.Error())
		return
	}

	httpx.WriteJSON(w, http.StatusOK, state)
}

func (h *WhatsAppHandler) ConnectSession(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.AuthClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "Session tenant tidak valid.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	state, err := h.service.ConnectSession(ctx, claims.TenantID)
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "whatsapp_connect_failed", err.Error())
		return
	}

	httpx.WriteJSON(w, http.StatusOK, state)
}

func (h *WhatsAppHandler) DisconnectSession(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.AuthClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "Session tenant tidak valid.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	state, err := h.service.DisconnectSession(ctx, claims.TenantID)
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "whatsapp_disconnect_failed", err.Error())
		return
	}

	httpx.WriteJSON(w, http.StatusOK, state)
}

func (h *WhatsAppHandler) SendTestMessage(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.AuthClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "Session tenant tidak valid.")
		return
	}

	var input whatsapp.SendTestInput
	if err := httpx.DecodeJSON(r, &input); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_json", "Payload JSON tidak valid.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 25*time.Second)
	defer cancel()

	state, err := h.service.SendTestMessage(ctx, claims.TenantID, input)
	if err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "whatsapp_send_test_failed", err.Error())
		return
	}

	httpx.WriteJSON(w, http.StatusOK, state)
}
