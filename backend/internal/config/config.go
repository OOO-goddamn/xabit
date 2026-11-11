package config

import (
	"os"
	"strings"
)

type Config struct {
	Port        string
	DatabaseURL string
	CORSOrigins []string
	Environment string

	// Web Push (VAPID). Push is disabled while either key is empty.
	VAPIDPublicKey  string
	VAPIDPrivateKey string
	VAPIDSubject    string

	// Public URL of the frontend, used as the target of notification clicks.
	PublicAppURL string
}

func Load() Config {
	cfg := Config{
		Port:            getEnv("PORT", "8080"),
		DatabaseURL:     getEnv("DATABASE_URL", "postgres://habit:habit@localhost:5432/habit?sslmode=disable"),
		Environment:     getEnv("APP_ENV", "development"),
		VAPIDPublicKey:  getEnv("VAPID_PUBLIC_KEY", ""),
		VAPIDPrivateKey: getEnv("VAPID_PRIVATE_KEY", ""),
		VAPIDSubject:    getEnv("VAPID_SUBJECT", "mailto:admin@example.com"),
		PublicAppURL:    getEnv("PUBLIC_APP_URL", "http://localhost:3000"),
	}

	origins := strings.Split(getEnv("CORS_ORIGINS", "*"), ",")
	for _, origin := range origins {
		if origin = strings.TrimSpace(origin); origin != "" {
			cfg.CORSOrigins = append(cfg.CORSOrigins, origin)
		}
	}

	return cfg
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok && strings.TrimSpace(value) != "" {
		return strings.TrimSpace(value)
	}
	return fallback
}
