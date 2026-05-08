package middleware

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"net/http"

	"balikcukur/pkg/httpx"
)

type requestIDKey string

const requestContextKey requestIDKey = "request_id"

func RequestID() httpx.Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			requestID := r.Header.Get("X-Request-ID")
			if requestID == "" {
				requestID = randomHex(12)
			}

			w.Header().Set("X-Request-ID", requestID)
			ctx := context.WithValue(r.Context(), requestContextKey, requestID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func randomHex(length int) string {
	bytes := make([]byte, length)
	if _, err := rand.Read(bytes); err != nil {
		return "request-id-unavailable"
	}

	return hex.EncodeToString(bytes)
}
