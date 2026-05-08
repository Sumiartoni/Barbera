package handlers

import (
	"context"
	"errors"
	"net/http"
	"time"

	"balikcukur/internal/http/middleware"
	"balikcukur/internal/modules/teammembers"
	"balikcukur/pkg/httpx"
)

type TeamMembersHandler struct {
	service *teammembers.Service
}

func NewTeamMembersHandler(service *teammembers.Service) *TeamMembersHandler {
	return &TeamMembersHandler{service: service}
}

func (h *TeamMembersHandler) List(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.AuthClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "Session tenant tidak valid.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	items, err := h.service.List(ctx, claims.TenantID)
	if err != nil {
		httpx.WriteError(w, http.StatusInternalServerError, "team_members_failed", "Gagal memuat daftar tim.")
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{"members": items})
}

func (h *TeamMembersHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.AuthClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "Session tenant tidak valid.")
		return
	}

	var input teammembers.CreateInput
	if err := httpx.DecodeJSON(r, &input); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_json", "Payload JSON tidak valid.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	item, err := h.service.Create(ctx, claims.TenantID, input)
	if err != nil {
		switch {
		case errors.Is(err, teammembers.ErrValidation):
			httpx.WriteError(w, http.StatusBadRequest, "validation_failed", "Data anggota tim belum lengkap atau tidak valid.")
		case errors.Is(err, teammembers.ErrEmailUsed):
			httpx.WriteError(w, http.StatusConflict, "email_used", "Email ini sudah dipakai akun lain.")
		default:
			httpx.WriteError(w, http.StatusInternalServerError, "team_member_create_failed", "Gagal menambahkan anggota tim.")
		}
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, item)
}

func (h *TeamMembersHandler) Update(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.AuthClaimsFromContext(r.Context())
	if !ok {
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "Session tenant tidak valid.")
		return
	}

	var input teammembers.UpdateInput
	if err := httpx.DecodeJSON(r, &input); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "invalid_json", "Payload JSON tidak valid.")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	item, err := h.service.Update(ctx, claims.TenantID, r.PathValue("membershipID"), input)
	if err != nil {
		switch {
		case errors.Is(err, teammembers.ErrValidation):
			httpx.WriteError(w, http.StatusBadRequest, "validation_failed", "Data anggota tim tidak valid.")
		case errors.Is(err, teammembers.ErrMemberNotFound):
			httpx.WriteError(w, http.StatusNotFound, "not_found", "Anggota tim tidak ditemukan.")
		case errors.Is(err, teammembers.ErrPrimaryOwner):
			httpx.WriteError(w, http.StatusConflict, "primary_owner_locked", "Owner utama tidak bisa dinonaktifkan atau dipindah role.")
		default:
			httpx.WriteError(w, http.StatusInternalServerError, "team_member_update_failed", "Gagal memperbarui anggota tim.")
		}
		return
	}

	httpx.WriteJSON(w, http.StatusOK, item)
}
