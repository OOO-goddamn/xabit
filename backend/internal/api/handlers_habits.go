package api

import (
	"errors"
	"net/http"
	"sort"
	"strings"
	"time"

	"habit/backend/internal/models"
)

type habitPayload struct {
	Name         string `json:"name"`
	Description  string `json:"description"`
	CategoryID   int64  `json:"categoryId"`
	ReminderTime string `json:"reminderTime"`
	models.Schedule
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

	habit, err := h.store.CreateHabit(r.Context(), currentUserID(r), payload.Name, payload.Description, payload.CategoryID, payload.ReminderTime, payload.Schedule)
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

	habit, err := h.store.UpdateHabit(r.Context(), currentUserID(r), id, payload.Name, payload.Description, payload.CategoryID, payload.ReminderTime, payload.Schedule)
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

	schedule, err := normalizeSchedule(payload.Schedule)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, err.Error())
		return payload, false
	}
	payload.Schedule = schedule

	return payload, true
}

func normalizeSchedule(schedule models.Schedule) (models.Schedule, error) {
	repeat := strings.ToLower(strings.TrimSpace(schedule.Repeat))
	if repeat == "" {
		repeat = "daily"
	}

	normalized := models.Schedule{Repeat: repeat}

	switch repeat {
	case "daily":
		return normalized, nil

	case "weekly":
		if len(schedule.Weekdays) == 0 {
			return normalized, errors.New("Выберите хотя бы один день недели")
		}

		seen := make(map[int]bool, len(schedule.Weekdays))
		for _, day := range schedule.Weekdays {
			if day < 1 || day > 7 {
				return normalized, errors.New("День недели должен быть от 1 (понедельник) до 7 (воскресенье)")
			}
			if !seen[day] {
				seen[day] = true
				normalized.Weekdays = append(normalized.Weekdays, day)
			}
		}
		sort.Ints(normalized.Weekdays)
		return normalized, nil

	case "monthly":
		if schedule.MonthDay == nil {
			return normalized, errors.New("Выберите день месяца")
		}
		if *schedule.MonthDay < 1 || *schedule.MonthDay > 31 {
			return normalized, errors.New("День месяца должен быть от 1 до 31")
		}
		day := *schedule.MonthDay
		normalized.MonthDay = &day
		return normalized, nil

	default:
		return normalized, errors.New("Повторение может быть daily, weekly или monthly")
	}
}
