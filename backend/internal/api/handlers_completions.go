package api

import (
	"net/http"
	"strings"
	"time"

	"habit/backend/internal/models"
	"habit/backend/internal/store"
)

type completionPayload struct {
	HabitID int64  `json:"habitId"`
	Date    string `json:"date"`
	Status  string `json:"status"`
	Note    string `json:"note"`
}

func (h *Handler) listCompletions(w http.ResponseWriter, r *http.Request) {
	from, err := queryDate(r, "from", today().AddDate(0, 0, -30))
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	to, err := queryDate(r, "to", today())
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if to.Before(from) {
		writeError(w, http.StatusBadRequest, "Дата начала не может быть позже даты окончания")
		return
	}

	habitID, err := optionalID(r.URL.Query().Get("habitId"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	completions, err := h.store.ListCompletions(r.Context(), store.CompletionFilter{
		UserID:  currentUserID(r),
		HabitID: habitID,
		From:    &from,
		To:      &to,
	})
	if err != nil {
		h.fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, completions)
}

func (h *Handler) saveCompletion(w http.ResponseWriter, r *http.Request) {
	var payload completionPayload
	if err := decodeJSON(w, r, &payload); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	if payload.HabitID <= 0 {
		writeError(w, http.StatusUnprocessableEntity, "Не выбрана привычка")
		return
	}

	date, err := time.Parse(time.DateOnly, strings.TrimSpace(payload.Date))
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, "Дата должна быть в формате YYYY-MM-DD")
		return
	}

	status := strings.TrimSpace(payload.Status)
	if status != models.StatusDone && status != models.StatusSkipped {
		writeError(w, http.StatusUnprocessableEntity, "Статус может быть только done или skipped")
		return
	}

	note := strings.TrimSpace(payload.Note)
	if len([]rune(note)) > maxNoteLen {
		writeError(w, http.StatusUnprocessableEntity, "Заметка не должна быть длиннее 2000 символов")
		return
	}

	completion, err := h.store.UpsertCompletion(r.Context(), currentUserID(r), payload.HabitID, date, status, note)
	if err != nil {
		h.fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, completion)
}

func (h *Handler) deleteCompletion(w http.ResponseWriter, r *http.Request) {
	habitID, err := optionalID(r.URL.Query().Get("habitId"))
	if err != nil || habitID == nil {
		writeError(w, http.StatusBadRequest, "Не указана привычка")
		return
	}

	rawDate := strings.TrimSpace(r.URL.Query().Get("date"))
	if rawDate == "" {
		writeError(w, http.StatusBadRequest, "Укажите дату в формате YYYY-MM-DD")
		return
	}
	date, err := time.Parse(time.DateOnly, rawDate)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Укажите дату в формате YYYY-MM-DD")
		return
	}

	if err := h.store.DeleteCompletion(r.Context(), currentUserID(r), *habitID, date); err != nil {
		h.fail(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
