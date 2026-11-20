package api

import (
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"
)

const maxFeedbackMessageLen = 2000

var (
	errInvalidFeedbackKind    = errors.New("Выберите тип обратной связи")
	errEmptyFeedbackMessage   = errors.New("Напишите сообщение")
	errFeedbackMessageTooLong = errors.New("Сообщение не должно быть длиннее 2000 символов")
)

type feedbackPayload struct {
	Kind    string `json:"kind"`
	Message string `json:"message"`
}

func (h *Handler) createFeedback(w http.ResponseWriter, r *http.Request) {
	var payload feedbackPayload
	if err := decodeJSON(w, r, &payload); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	kind := strings.TrimSpace(payload.Kind)
	message := strings.TrimSpace(payload.Message)
	if err := validateFeedback(kind, message); err != nil {
		writeError(w, http.StatusUnprocessableEntity, err.Error())
		return
	}

	id, createdAt, err := h.store.CreateFeedback(r.Context(), currentUserID(r), kind, message)
	if err != nil {
		h.fail(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"id":        id,
		"createdAt": createdAt.Format(time.RFC3339),
	})
}

func (h *Handler) feedbackAccess(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]bool{
		"canView": feedbackAdminAllowed(h.feedbackAdminEmail, currentUser(r).Email),
	})
}

func (h *Handler) listFeedback(w http.ResponseWriter, r *http.Request) {
	if !feedbackAdminAllowed(h.feedbackAdminEmail, currentUser(r).Email) {
		writeError(w, http.StatusForbidden, "Нет доступа к отзывам")
		return
	}

	items, err := h.store.ListFeedback(r.Context(), 100)
	if err != nil {
		slog.Error("load feedback failed", "error", err)
		writeError(w, http.StatusInternalServerError, "Не удалось загрузить отзывы")
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func feedbackAdminAllowed(adminEmail, userEmail string) bool {
	return strings.TrimSpace(adminEmail) != "" && strings.EqualFold(strings.TrimSpace(adminEmail), strings.TrimSpace(userEmail))
}

func validateFeedback(kind, message string) error {
	switch kind {
	case "idea", "bug", "other":
	default:
		return errInvalidFeedbackKind
	}
	if message == "" {
		return errEmptyFeedbackMessage
	}
	if len([]rune(message)) > maxFeedbackMessageLen {
		return errFeedbackMessageTooLong
	}
	return nil
}
