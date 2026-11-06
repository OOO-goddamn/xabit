package api

import (
	"context"
	"net/http"
	"strings"
	"time"

	"habit/backend/internal/auth"
	"habit/backend/internal/models"
)

const (
	minPasswordLen = 8
	maxPasswordLen = 128
	maxUserNameLen = 80
	sessionTTL     = 30 * 24 * time.Hour
)

type registerPayload struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
}

type loginPayload struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type authResponse struct {
	Token string      `json:"token"`
	User  models.User `json:"user"`
}

func (h *Handler) register(w http.ResponseWriter, r *http.Request) {
	var payload registerPayload
	if err := decodeJSON(w, r, &payload); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	email := auth.NormalizeEmail(payload.Email)
	if err := validateRegistrationEmail(email); err != nil {
		writeError(w, http.StatusUnprocessableEntity, err.Error())
		return
	}

	password := payload.Password
	if len(password) < minPasswordLen {
		writeError(w, http.StatusUnprocessableEntity, "Пароль должен быть не короче 8 символов")
		return
	}
	if len(password) > maxPasswordLen {
		writeError(w, http.StatusUnprocessableEntity, "Пароль слишком длинный")
		return
	}

	name := strings.TrimSpace(payload.Name)
	if len([]rune(name)) > maxUserNameLen {
		writeError(w, http.StatusUnprocessableEntity, "Имя не должно быть длиннее 80 символов")
		return
	}
	if name == "" {
		name = strings.Split(email, "@")[0]
	}

	passwordHash, err := auth.HashPassword(password)
	if err != nil {
		h.fail(w, err)
		return
	}

	user, err := h.store.CreateUser(r.Context(), email, name, passwordHash)
	if err != nil {
		h.fail(w, err)
		return
	}

	token, ok := h.startSession(w, r, user)
	if !ok {
		return
	}

	writeJSON(w, http.StatusCreated, authResponse{Token: token, User: user})
}

func (h *Handler) login(w http.ResponseWriter, r *http.Request) {
	var payload loginPayload
	if err := decodeJSON(w, r, &payload); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	email := auth.NormalizeEmail(payload.Email)
	user, err := h.store.UserByEmail(r.Context(), email)
	if err != nil || !auth.VerifyPassword(user.PasswordHash, payload.Password) {
		writeError(w, http.StatusUnauthorized, "Неверный email или пароль")
		return
	}

	token, ok := h.startSession(w, r, user)
	if !ok {
		return
	}

	writeJSON(w, http.StatusOK, authResponse{Token: token, User: user})
}

func (h *Handler) logout(w http.ResponseWriter, r *http.Request) {
	if hash, ok := r.Context().Value(sessionKey{}).(string); ok && hash != "" {
		if err := h.store.DeleteSession(r.Context(), hash); err != nil {
			h.fail(w, err)
			return
		}
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) me(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value(userKey{}).(models.User)
	if !ok {
		writeError(w, http.StatusUnauthorized, "Требуется вход")
		return
	}
	writeJSON(w, http.StatusOK, user)
}

func (h *Handler) startSession(w http.ResponseWriter, r *http.Request, user models.User) (string, bool) {
	token, tokenHash, err := auth.NewSessionToken()
	if err != nil {
		h.fail(w, err)
		return "", false
	}

	if err := h.store.CreateSession(r.Context(), user.ID, tokenHash, time.Now().Add(sessionTTL)); err != nil {
		h.fail(w, err)
		return "", false
	}

	return token, true
}

func validateRegistrationEmail(email string) error {
	return auth.ValidateEmail(email)
}

type userKey struct{}

type sessionKey struct{}

func currentUser(r *http.Request) models.User {
	user, _ := r.Context().Value(userKey{}).(models.User)
	return user
}

func currentUserID(r *http.Request) int64 {
	return currentUser(r).ID
}

func withUser(ctx context.Context, user models.User) context.Context {
	return context.WithValue(ctx, userKey{}, user)
}

func isPublicPath(path string) bool {
	switch path {
	case "/api/health", "/api/auth/register", "/api/auth/login":
		return true
	default:
		return false
	}
}

func (h *Handler) withAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodOptions || isPublicPath(r.URL.Path) {
			next.ServeHTTP(w, r)
			return
		}

		header := strings.TrimSpace(r.Header.Get("Authorization"))
		token, found := strings.CutPrefix(header, "Bearer ")
		token = strings.TrimSpace(token)
		if !found || token == "" {
			writeError(w, http.StatusUnauthorized, "Требуется вход")
			return
		}

		tokenHash := auth.HashSessionToken(token)
		user, err := h.store.UserBySessionToken(r.Context(), tokenHash, time.Now())
		if err != nil {
			writeError(w, http.StatusUnauthorized, "Сессия истекла. Войдите снова")
			return
		}

		ctx := withUser(r.Context(), user)
		ctx = context.WithValue(ctx, sessionKey{}, tokenHash)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
