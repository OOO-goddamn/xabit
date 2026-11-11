package api

import (
	"net/http"
	"strings"
	"time"
)

type habitPayload struct {
	Name         string `json:"name"`
	Description  string `json:"description"`
	CategoryID   int64  `json:"categoryId"`
	ReminderTime string `json:"reminderTime"`
}

func (h *Handler) listHabits(w http.ResponseWriter, r *http.Request) {
	categoryID, err := optionalID(r.URL.Query().Get("categoryId"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	habits, err := h.store.ListHabits(r.Context(), currentUserID(r), categoryID)
	if err != nil {
		h.fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, habits)
}

func (h *Handler) getHabit(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	habit, err := h.store.GetHabit(r.Context(), currentUserID(r), id)
	if err != nil {
		h.fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, habit)
}

func (h *Handler) createHabit(w http.ResponseWriter, r *http.Request) {
	payload, ok := h.readHabitPayload(w, r)
	if !ok {
		return
	}

	habit, err := h.store.CreateHabit(r.Context(), currentUserID(r), payload.Name, payload.Description, payload.CategoryID, payload.ReminderTime)
	if err != nil {
		h.fail(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, habit)
}

func (h *Handler) updateHabit(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	payload, ok := h.readHabitPayload(w, r)
	if !ok {
		return
	}

	habit, err := h.store.UpdateHabit(r.Context(), currentUserID(r), id, payload.Name, payload.Description, payload.CategoryID, payload.ReminderTime)
	if err != nil {
		h.fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, habit)
}

func (h *Handler) deleteHabit(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	if err := h.store.DeleteHabit(r.Context(), currentUserID(r), id); err != nil {
		h.fail(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) readHabitPayload(w http.ResponseWriter, r *http.Request) (habitPayload, bool) {
	var payload habitPayload
	if err := decodeJSON(w, r, &payload); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return payload, false
	}

	name, err := validateName(payload.Name, "Название привычки", maxHabitNameLen)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, err.Error())
		return payload, false
	}

	description := strings.TrimSpace(payload.Description)
	if len([]rune(description)) > maxDescriptionLen {
		writeError(w, http.StatusUnprocessableEntity, "Описание не должно быть длиннее 2000 символов")
		return payload, false
	}

	if payload.CategoryID <= 0 {
		writeError(w, http.StatusUnprocessableEntity, "Выберите категорию")
		return payload, false
	}

	reminder := strings.TrimSpace(payload.ReminderTime)
	if reminder != "" {
		parsed, err := time.Parse("15:04", reminder)
		if err != nil || parsed.Format("15:04") != reminder {
			writeError(w, http.StatusUnprocessableEntity, "Время напоминания должно быть в формате ЧЧ:ММ")
			return payload, false
		}
	}

	payload.Name = name
	payload.Description = description
	payload.ReminderTime = reminder

	return payload, true
}
