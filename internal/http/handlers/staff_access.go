package handlers

import (
	"context"
	"errors"
	"net/http"
	"time"

	"balikcukur/internal/http/middleware"
	"balikcukur/internal/modules/staffaccess"
	"balikcukur/pkg/httpx"
)

type StaffAccessHandler struct {
	service *staffaccess.Service
}

func NewStaffAccessHandler(service *staffaccess.Service) *StaffAccessHandler {
	return &StaffAccessHandler{service: service}
}

func (h *StaffAccessHandler) List(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.AuthClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "Session tenant tidak valid.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	accounts, err := h.service.List(ctx, claims.TenantID)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "barber_access_failed", "Gagal memuat akses barber.")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{"accounts": accounts})
}

func (h *StaffAccessHandler) Provision(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.AuthClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "Session tenant tidak valid.")
		return
	}

	var input staffaccess.ProvisionInput
	if err := httpx.DecodeJSON(r, &input); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_json", "Payload JSON tidak valid.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	account, err := h.service.Provision(ctx, claims.TenantID, input)
	if err != nil {
		switch {
		case errors.Is(err, staffaccess.ErrValidation):
			httpx.WriteError(w, http.StatusBadRequest, "validation_failed", "Barber dan PIN minimal 4 digit wajib valid.")
		case errors.Is(err, staffaccess.ErrBarberNotFound):
			httpx.WriteError(w, http.StatusNotFound, "barber_not_found", "Barber aktif tidak ditemukan.")
		default:
			httpx.WriteError(w, http.StatusInternalServerError, "barber_access_provision_failed", "Gagal membuat akses barber.")
		}
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, account)
}

func (h *StaffAccessHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.AuthClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "Session tenant tidak valid.")
		return
	}

	var input staffaccess.UpdateInput
	if err := httpx.DecodeJSON(r, &input); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_json", "Payload JSON tidak valid.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	account, err := h.service.Update(ctx, claims.TenantID, r.PathValue("accountID"), input)
	if err != nil {
		switch {
		case errors.Is(err, staffaccess.ErrValidation):
			httpx.WriteError(w, http.StatusBadRequest, "validation_failed", "Status atau PIN barber tidak valid.")
		case errors.Is(err, staffaccess.ErrCredentialInvalid):
			httpx.WriteError(w, http.StatusNotFound, "not_found", "Akses barber tidak ditemukan.")
		default:
			httpx.WriteError(w, http.StatusInternalServerError, "barber_access_update_failed", "Gagal memperbarui akses barber.")
		}
		return
	}

	httpx.WriteJSON(w, http.StatusOK, account)
}

func (h *StaffAccessHandler) POSLogin(w http.ResponseWriter, r *http.Request) {
	var input staffaccess.LoginInput
	if err := httpx.DecodeJSON(r, &input); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_json", "Payload JSON tidak valid.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	session, err := h.service.Login(ctx, input)
	if err != nil {
		switch {
		case errors.Is(err, staffaccess.ErrValidation):
			httpx.WriteError(w, http.StatusBadRequest, "validation_failed", "Kode akses dan PIN wajib diisi.")
		case errors.Is(err, staffaccess.ErrAccessDisabled):
			httpx.WriteError(w, http.StatusForbidden, "access_disabled", "Akses barber sedang dinonaktifkan.")
		case errors.Is(err, staffaccess.ErrCredentialInvalid):
			httpx.WriteError(w, http.StatusUnauthorized, "invalid_credentials", "Kode akses atau PIN salah.")
		default:
			httpx.WriteError(w, http.StatusInternalServerError, "pos_login_failed", "Login POS gagal.")
		}
		return
	}

	httpx.WriteJSON(w, http.StatusOK, session)
}

func (h *StaffAccessHandler) POSMe(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.AuthClaimsFromContext(r.Context())
	if !ok || claims.ActorType != "staff" {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "Session POS tidak valid.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	session, err := h.service.Profile(ctx, claims)
	if err != nil {
		httpx.WriteError(w, http.StatusUnauthorized, "pos_profile_failed", "Session POS tidak ditemukan.")
		return
	}
	session.AccessToken = ""
	session.ExpiresAt = claims.ExpiresAt

	httpx.WriteJSON(w, http.StatusOK, session)
}
