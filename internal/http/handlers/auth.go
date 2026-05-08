package handlers

import (
	"context"
	"errors"
	"net/http"
	"time"

	"balikcukur/internal/http/middleware"
	"balikcukur/internal/modules/auth"
	"balikcukur/pkg/httpx"
)

type AuthHandler struct {
	service *auth.Service
}

func NewAuthHandler(service *auth.Service) *AuthHandler {
	return &AuthHandler{service: service}
}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var input auth.RegisterInput
	if err := httpx.DecodeJSON(r, &input); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_json", "Payload JSON tidak valid.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	result, err := h.service.Register(ctx, input)
	if err != nil {
		switch {
		case errors.Is(err, auth.ErrValidation):
			httpx.WriteError(w, http.StatusBadRequest, "validation_failed", "Nama barbershop, nama owner, email, dan password minimal 8 karakter wajib diisi.")
		case errors.Is(err, auth.ErrEmailAlreadyUsed):
			httpx.WriteError(w, http.StatusConflict, "email_already_used", "Email sudah terdaftar.")
		case errors.Is(err, auth.ErrFreePlanMissing):
			httpx.WriteError(w, http.StatusServiceUnavailable, "free_plan_missing", "Paket Free belum tersedia di sistem.")
		default:
			httpx.WriteError(w, http.StatusInternalServerError, "register_failed", "Registrasi tenant gagal.")
		}
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, result)
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var input auth.LoginInput
	if err := httpx.DecodeJSON(r, &input); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_json", "Payload JSON tidak valid.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	result, err := h.service.Login(ctx, input)
	if err != nil {
		switch {
		case errors.Is(err, auth.ErrValidation):
			httpx.WriteError(w, http.StatusBadRequest, "validation_failed", "Email dan password wajib diisi.")
		case errors.Is(err, auth.ErrInvalidCredential):
			httpx.WriteError(w, http.StatusUnauthorized, "invalid_credentials", "Email atau password salah.")
		default:
			httpx.WriteError(w, http.StatusInternalServerError, "login_failed", "Login gagal.")
		}
		return
	}

	httpx.WriteJSON(w, http.StatusOK, result)
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.AuthClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "Token tidak valid.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	profile, err := h.service.GetProfile(ctx, auth.AuthClaims{
		UserID:    claims.UserID,
		TenantID:  claims.TenantID,
		Role:      claims.Role,
		ExpiresAt: claims.ExpiresAt,
	})
	if err != nil {
		httpx.WriteError(w, http.StatusUnauthorized, "profile_not_found", "Profile tenant tidak ditemukan.")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, profile)
}
