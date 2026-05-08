package middleware

import (
	"crypto/subtle"
	"net/http"
	"strings"

	"balikcukur/pkg/httpx"
)

func RequirePlatformAdminKey(expected string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if strings.TrimSpace(expected) == "" {
				httpx.WriteError(w, http.StatusServiceUnavailable, "platform_key_missing", "Platform admin key belum dikonfigurasi.")
				return
			}

			provided := strings.TrimSpace(r.Header.Get("X-Platform-Admin-Key"))
			if subtle.ConstantTimeCompare([]byte(provided), []byte(expected)) != 1 {
				httpx.WriteError(w, http.StatusUnauthorized, "platform_key_invalid", "Akses platform tidak valid.")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
