package config

import (
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/joho/godotenv"
)

var loadEnvOnce sync.Once

type Config struct {
	App      AppConfig
	HTTP     HTTPConfig
	Security SecurityConfig
	Auth     AuthConfig
	Platform PlatformConfig
	Postgres PostgresConfig
	Redis    RedisConfig
	WhatsApp WhatsAppConfig
}

type AppConfig struct {
	Name      string
	Env       string
	PublicURL string
}

type HTTPConfig struct {
	BindAddress  string
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
	IdleTimeout  time.Duration
}

type SecurityConfig struct {
	AllowedOrigins        []string
	TrustedProxyCIDRs     []string
	TrustProxyHeaders     bool
	ContentSecurityPolicy string
	EnableHSTS            bool
	SessionEncryptionKey  string
	JWTSigningKey         string
	RateLimit             RateLimitConfig
}

type AuthConfig struct {
	JWTSigningKey  string
	AccessTokenTTL time.Duration
}

type PlatformConfig struct {
	AdminAPIKey string
}

type RateLimitConfig struct {
	Enabled           bool
	RequestsPerMinute int
	Burst             int
	TrustProxyHeaders bool
}

type PostgresConfig struct {
	DSN string
}

type RedisConfig struct {
	Address  string
	Password string
	DB       int
}

type WhatsAppConfig struct {
	SessionEncryptionKey string
}

func Load() Config {
	loadEnvOnce.Do(func() {
		_ = godotenv.Load()
	})

	return Config{
		App: AppConfig{
			Name:      env("APP_NAME", "balikcukur"),
			Env:       env("APP_ENV", "development"),
			PublicURL: env("APP_PUBLIC_URL", "http://localhost:3000"),
		},
		HTTP: HTTPConfig{
			BindAddress:  env("HTTP_BIND_ADDRESS", ":8080"),
			ReadTimeout:  envDuration("HTTP_READ_TIMEOUT", 10*time.Second),
			WriteTimeout: envDuration("HTTP_WRITE_TIMEOUT", 30*time.Second),
			IdleTimeout:  envDuration("HTTP_IDLE_TIMEOUT", 120*time.Second),
		},
		Security: SecurityConfig{
			AllowedOrigins:        csv("ALLOWED_ORIGINS"),
			TrustedProxyCIDRs:     csv("TRUSTED_PROXY_CIDRS"),
			TrustProxyHeaders:     envBool("TRUST_PROXY_HEADERS", true),
			ContentSecurityPolicy: env("CONTENT_SECURITY_POLICY", ""),
			EnableHSTS:            envBool("ENABLE_HSTS", env("APP_ENV", "development") == "production"),
			SessionEncryptionKey:  env("SESSION_ENCRYPTION_KEY_BASE64", ""),
			JWTSigningKey:         env("JWT_SIGNING_KEY", ""),
			RateLimit: RateLimitConfig{
				Enabled:           envBool("RATE_LIMIT_ENABLED", true),
				RequestsPerMinute: envInt("RATE_LIMIT_REQUESTS_PER_MINUTE", 120),
				Burst:             envInt("RATE_LIMIT_BURST", 20),
				TrustProxyHeaders: envBool("TRUST_PROXY_HEADERS", true),
			},
		},
		Auth: AuthConfig{
			JWTSigningKey:  env("JWT_SIGNING_KEY", "dev-insecure-signing-key-change-me"),
			AccessTokenTTL: envDuration("JWT_ACCESS_TOKEN_TTL", 24*time.Hour),
		},
		Platform: PlatformConfig{
			AdminAPIKey: env("PLATFORM_ADMIN_API_KEY", "dev-platform-admin-key-change-me"),
		},
		Postgres: PostgresConfig{
			DSN: env("POSTGRES_DSN", ""),
		},
		Redis: RedisConfig{
			Address:  env("REDIS_ADDR", "localhost:6379"),
			Password: env("REDIS_PASSWORD", ""),
			DB:       envInt("REDIS_DB", 0),
		},
		WhatsApp: WhatsAppConfig{
			SessionEncryptionKey: env("WA_SESSION_ENCRYPTION_KEY_BASE64", ""),
		},
	}
}

func env(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok && strings.TrimSpace(value) != "" {
		return value
	}

	return fallback
}

func envBool(key string, fallback bool) bool {
	value, ok := os.LookupEnv(key)
	if !ok {
		return fallback
	}

	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return fallback
	}

	return parsed
}

func envInt(key string, fallback int) int {
	value, ok := os.LookupEnv(key)
	if !ok {
		return fallback
	}

	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}

	return parsed
}

func envDuration(key string, fallback time.Duration) time.Duration {
	value, ok := os.LookupEnv(key)
	if !ok {
		return fallback
	}

	parsed, err := time.ParseDuration(value)
	if err != nil {
		return fallback
	}

	return parsed
}

func csv(key string) []string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return nil
	}

	items := strings.Split(value, ",")
	result := make([]string, 0, len(items))
	for _, item := range items {
		if trimmed := strings.TrimSpace(item); trimmed != "" {
			result = append(result, trimmed)
		}
	}

	return result
}
