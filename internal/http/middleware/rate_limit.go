package middleware

import (
	"log/slog"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"balikcukur/pkg/config"
	"balikcukur/pkg/httpx"
)

type clientWindow struct {
	Count   int
	ResetAt time.Time
}

func RateLimit(cfg config.RateLimitConfig, logger *slog.Logger) httpx.Middleware {
	if !cfg.Enabled || cfg.RequestsPerMinute <= 0 {
		return func(next http.Handler) http.Handler {
			return next
		}
	}

	var (
		mu      sync.Mutex
		clients = map[string]clientWindow{}
	)

	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()

		for range ticker.C {
			now := time.Now().UTC()

			mu.Lock()
			for key, value := range clients {
				if now.After(value.ResetAt) {
					delete(clients, key)
				}
			}
			mu.Unlock()
		}
	}()

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			key := clientKey(r, cfg.TrustProxyHeaders)
			now := time.Now().UTC()

			mu.Lock()
			window := clients[key]

			if window.ResetAt.IsZero() || now.After(window.ResetAt) {
				window = clientWindow{
					Count:   0,
					ResetAt: now.Add(time.Minute),
				}
			}

			if window.Count >= cfg.RequestsPerMinute+cfg.Burst {
				retryAfter := int(time.Until(window.ResetAt).Seconds())
				if retryAfter < 1 {
					retryAfter = 1
				}

				mu.Unlock()
				logger.Warn("rate limit exceeded", "client", key, "path", r.URL.Path)
				w.Header().Set("Retry-After", strconv.Itoa(retryAfter))
				http.Error(w, http.StatusText(http.StatusTooManyRequests), http.StatusTooManyRequests)
				return
			}

			window.Count++
			clients[key] = window
			remaining := (cfg.RequestsPerMinute + cfg.Burst) - window.Count
			mu.Unlock()

			w.Header().Set("X-RateLimit-Limit", strconv.Itoa(cfg.RequestsPerMinute+cfg.Burst))
			w.Header().Set("X-RateLimit-Remaining", strconv.Itoa(max(remaining, 0)))
			next.ServeHTTP(w, r)
		})
	}
}

func clientKey(r *http.Request, trustProxyHeaders bool) string {
	if trustProxyHeaders {
		forwardedFor := strings.TrimSpace(strings.Split(r.Header.Get("X-Forwarded-For"), ",")[0])
		if forwardedFor != "" {
			return forwardedFor
		}
	}

	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}

	return host
}

func max(left, right int) int {
	if left > right {
		return left
	}

	return right
}
