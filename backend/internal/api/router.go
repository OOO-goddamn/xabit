package api

import (
	"log/slog"
	"net/http"
	"runtime/debug"
	"time"
)

func NewRouter(handler *Handler, corsOrigins []string) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/health", handler.health)

	mux.HandleFunc("POST /api/auth/register", handler.register)
	mux.HandleFunc("POST /api/auth/login", handler.login)
	mux.HandleFunc("POST /api/auth/logout", handler.logout)
	mux.HandleFunc("GET /api/auth/me", handler.me)

	mux.HandleFunc("GET /api/categories", handler.listCategories)
	mux.HandleFunc("POST /api/categories", handler.createCategory)
	mux.HandleFunc("PATCH /api/categories/{id}", handler.updateCategory)
	mux.HandleFunc("DELETE /api/categories/{id}", handler.deleteCategory)

	mux.HandleFunc("GET /api/habits", handler.listHabits)
	mux.HandleFunc("POST /api/habits", handler.createHabit)
	mux.HandleFunc("GET /api/habits/{id}", handler.getHabit)
	mux.HandleFunc("PATCH /api/habits/{id}", handler.updateHabit)
	mux.HandleFunc("DELETE /api/habits/{id}", handler.deleteHabit)

	mux.HandleFunc("GET /api/completions", handler.listCompletions)
	mux.HandleFunc("PUT /api/completions", handler.saveCompletion)
	mux.HandleFunc("DELETE /api/completions", handler.deleteCompletion)

	mux.HandleFunc("GET /api/dashboard", handler.dashboard)
	mux.HandleFunc("GET /api/stats", handler.stats)

	mux.HandleFunc("GET /api/push/config", handler.pushConfig)
	mux.HandleFunc("POST /api/push/subscriptions", handler.savePushSubscription)
	mux.HandleFunc("DELETE /api/push/subscriptions", handler.deletePushSubscription)
	mux.HandleFunc("POST /api/push/test", handler.testPush)

	var result http.Handler = mux
	result = handler.withAuth(result)
	result = withCORS(corsOrigins, result)
	result = withLogging(result)
	result = withRecovery(result)

	return result
}

func withCORS(origins []string, next http.Handler) http.Handler {
	allowed := make(map[string]bool, len(origins))
	for _, origin := range origins {
		allowed[origin] = true
	}
	allowAll := allowed["*"]

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")

		switch {
		case allowAll:
			w.Header().Set("Access-Control-Allow-Origin", "*")
		case origin != "" && allowed[origin]:
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
		default:
			next.ServeHTTP(w, r)
			return
		}

		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Max-Age", "86400")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (recorder *statusRecorder) WriteHeader(status int) {
	recorder.status = status
	recorder.ResponseWriter.WriteHeader(status)
}

func (recorder *statusRecorder) Write(data []byte) (int, error) {
	if recorder.status == 0 {
		recorder.status = http.StatusOK
	}
	return recorder.ResponseWriter.Write(data)
}

func withLogging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		started := time.Now()
		recorder := &statusRecorder{ResponseWriter: w}

		next.ServeHTTP(recorder, r)

		status := recorder.status
		if status == 0 {
			status = http.StatusOK
		}

		slog.Info("http request",
			"method", r.Method,
			"path", r.URL.RequestURI(),
			"status", status,
			"duration", time.Since(started).Round(time.Millisecond).String(),
		)
	})
}

func withRecovery(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if recovered := recover(); recovered != nil {
				slog.Error("panic recovered",
					"error", recovered,
					"path", r.URL.Path,
					"stack", string(debug.Stack()),
				)
				writeError(w, http.StatusInternalServerError, "Внутренняя ошибка сервера")
			}
		}()

		next.ServeHTTP(w, r)
	})
}
