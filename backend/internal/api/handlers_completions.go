package api

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"habit/backend/internal/models"
	"habit/backend/internal/store"
)

const maxCompletionValue = 1_000_000

type completionPayload struct {
	HabitID int64  `json:"habitId"`
	Date    string `json:"date"`
	Status  string `json:"status"`
	Value   *int   `json:"value"`
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
	note := strings.TrimSpace(payload.Note)
	if len([]rune(note)) > maxNoteLen {
		writeError(w, http.StatusUnprocessableEntity, "Заметка не должна быть длиннее 2000 символов")
		return
	}

	habit, err := h.store.GetHabit(r.Context(), currentUserID(r), payload.HabitID)
	if err != nil {
		h.fail(w, err)
		return
	}

	value := 0
	if habit.IsQuantity() {
		status, value, err = quantityStatus(habit, status, payload.Value)
		if err != nil {
			writeError(w, http.StatusUnprocessableEntity, err.Error())
			return
		}

		// Zero progress is the same as no mark at all. Drop the row so the
		// habit looks untouched and reminders keep working.
		if status == "" {
			if err := h.store.DeleteCompletion(r.Context(), currentUserID(r), payload.HabitID, date); err != nil && !errors.Is(err, store.ErrNotFound) {
				h.fail(w, err)
				return
			}
			w.WriteHeader(http.StatusNoContent)
			return
		}
	} else if status != models.StatusDone && status != models.StatusSkipped {
		writeError(w, http.StatusUnprocessableEntity, "Статус может быть только done или skipped")
		return
	}

	completion, err := h.store.UpsertCompletion(r.Context(), currentUserID(r), payload.HabitID, date, status, value, note)
	if err != nil {
		h.fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, completion)
}

// quantityStatus turns an amount into a completion status:
//
//	value >= target  -> done
//	value > 0        -> progress
//	value == 0       -> no mark (empty status)
//	explicit skip    -> skipped with value 0
//
// When the client only sends status=done (for example the completion dialog),
// the target itself is stored as the value.
func quantityStatus(habit models.Habit, requested string, raw *int) (string, int, error) {
	if requested == models.StatusSkipped {
		return models.StatusSkipped, 0, nil
	}
	if requested != "" && requested != models.StatusDone && requested != models.StatusProgress {
		return "", 0, errors.New("Статус может быть done, skipped или progress")
	}

	value := 0
	if raw != nil {
		value = *raw
	} else if requested == models.StatusDone {
		value = *habit.TargetValue
	}
	if value < 0 || value > maxCompletionValue {
		return "", 0, errors.New("Количество должно быть от 0 до 1 000 000")
	}

	switch {
	case value >= *habit.TargetValue:
		return models.StatusDone, value, nil
	case value > 0:
		return models.StatusProgress, value, nil
	default:
		return "", 0, nil
	}
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
