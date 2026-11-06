package api

import (
	"errors"
	"log/slog"
	"net/http"

	"habit/backend/internal/store"
)

type Handler struct {
	store *store.Store
}

func NewHandler(st *store.Store) *Handler {
	return &Handler{store: st}
}

func (h *Handler) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handler) fail(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, store.ErrNotFound):
		writeError(w, http.StatusNotFound, "Не найдено")
	case errors.Is(err, store.ErrConflict):
		writeError(w, http.StatusConflict, "Такая категория уже существует")
	case errors.Is(err, store.ErrEmailTaken):
		writeError(w, http.StatusConflict, "Пользователь с таким email уже зарегистрирован")
	case errors.Is(err, store.ErrCategoryInUse):
		writeError(w, http.StatusConflict, "В категории есть привычки. Сначала перенесите или удалите их")
	case errors.Is(err, store.ErrCategoryNotFound):
		writeError(w, http.StatusBadRequest, "Категория не найдена")
	case errors.Is(err, store.ErrHabitNotFound):
		writeError(w, http.StatusBadRequest, "Привычка не найдена")
	default:
		slog.Error("request failed", "error", err)
		writeError(w, http.StatusInternalServerError, "Внутренняя ошибка сервера")
	}
}
