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
}

func Load() Config {
	cfg := Config{
		Port:        getEnv("PORT", "8080"),
		DatabaseURL: getEnv("DATABASE_URL", "postgres://habit:habit@localhost:5432/habit?sslmode=disable"),
		Environment: getEnv("APP_ENV", "development"),
	}

	origins := strings.Split(getEnv("CORS_ORIGINS", "http://localhost:3000"), ",")
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
