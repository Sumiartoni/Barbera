package middleware

import (
	"context"
	"net/http"

	"balikcukur/pkg/httpx"
)

type tenantKey string

const tenantContextKey tenantKey = "tenant_id"

func TenantScope() httpx.Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Placeholder sementara. Pada implementasi final, tenant scope harus
			// diturunkan dari auth/session yang tervalidasi, bukan dipercaya mentah
			// dari request publik.
			tenantID := r.Header.Get("X-Tenant-ID")
			if tenantID == "" {
				next.ServeHTTP(w, r)
				return
			}

			ctx := context.WithValue(r.Context(), tenantContextKey, tenantID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
