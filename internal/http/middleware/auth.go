package middleware

import (
	"context"
	"net/http"
	"strings"
	"time"

	"balikcukur/internal/modules/auth"
	"balikcukur/pkg/httpx"
)

type authClaimsKey string

const authContextKey authClaimsKey = "auth_claims"

type authService interface {
	ParseToken(rawToken string) (auth.AuthClaims, error)
}

func RequireAuth(service authService) httpx.Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := strings.TrimSpace(r.Header.Get("Authorization"))
			if header == "" || !strings.HasPrefix(header, "Bearer ") {
				httpx.WriteError(w, http.StatusUnauthorized, "missing_token", "Bearer token wajib dikirim.")
				return
			}

			rawToken := strings.TrimSpace(strings.TrimPrefix(header, "Bearer "))
			claims, err := service.ParseToken(rawToken)
			if err != nil {
				httpx.WriteError(w, http.StatusUnauthorized, "invalid_token", "Token tidak valid atau sudah kedaluwarsa.")
				return
			}

			ctx := context.WithValue(r.Context(), authContextKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func AuthClaimsFromContext(ctx context.Context) (auth.AuthClaims, bool) {
	claims, ok := ctx.Value(authContextKey).(auth.AuthClaims)
	if !ok || claims.UserID == "" || claims.TenantID == "" || claims.ExpiresAt.Before(time.Now().UTC()) {
		return auth.AuthClaims{}, false
	}

	return claims, true
}
