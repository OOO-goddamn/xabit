package api

import (
	"errors"
	"net/http"
	"strings"
	"time"
)

const (
	maxTaskTitleLen = 200
	maxTaskNoteLen  = 2000
)

type taskPayload struct {
	Title    string  `json:"title"`
	Note     string  `json:"note"`
	Priority string  `json:"priority"`
	DueDate  *string `json:"dueDate"`
	DueTime  string  `json:"dueTime"`
	Done     bool    `json:"done"`
}

// validatedTask keeps the parsed task fields together so handlers do not pass
// half a dozen positional values around.
type validatedTask struct {
	Title    string
	Note     string
	Priority string
	DueDate  *time.Time
	DueTime  *string
}

func (h *Handler) listTasks(w http.ResponseWriter, r *http.Request) {
	tasks, err := h.store.ListTasks(r.Context(), currentUserID(r))
	if err != nil {
		h.fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, tasks)
}

func (h *Handler) createTask(w http.ResponseWriter, r *http.Request) {
	var payload taskPayload
	if err := decodeJSON(w, r, &payload); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	input, err := validateTask(payload)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, err.Error())
		return
	}

	task, err := h.store.CreateTask(r.Context(), currentUserID(r), input.Title, input.Note, input.Priority, input.DueDate, input.DueTime)
	if err != nil {
		h.fail(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, task)
}

func (h *Handler) updateTask(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	var payload taskPayload
	if err := decodeJSON(w, r, &payload); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	input, err := validateTask(payload)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, err.Error())
		return
	}

	task, err := h.store.UpdateTask(
		r.Context(), currentUserID(r), id,
		input.Title, input.Note, input.Priority, input.DueDate, input.DueTime, payload.Done,
	)
	if err != nil {
		h.fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, task)
}

func (h *Handler) deleteTask(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	if err := h.store.DeleteTask(r.Context(), currentUserID(r), id); err != nil {
		h.fail(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) reorderTasks(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		IDs []int64 `json:"ids"`
	}
	if err := decodeJSON(w, r, &payload); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := validateOrderIDs(payload.IDs); err != nil {
		writeError(w, http.StatusUnprocessableEntity, err.Error())
		return
	}

	if err := h.store.ReorderTasks(r.Context(), currentUserID(r), payload.IDs); err != nil {
		h.fail(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func validateTask(payload taskPayload) (validatedTask, error) {
	var input validatedTask

	title, err := validateName(payload.Title, "Название задачи", maxTaskTitleLen)
	if err != nil {
		return input, err
	}
	input.Title = title

	note := strings.TrimSpace(payload.Note)
	if len([]rune(note)) > maxTaskNoteLen {
		return input, errors.New("Описание не должно быть длиннее 2000 символов")
	}
	input.Note = note

	priority, err := validateTaskPriority(payload.Priority)
	if err != nil {
		return input, err
	}
	input.Priority = priority

	dueDate, err := optionalDate(payload.DueDate)
	if err != nil {
		return input, err
	}
	input.DueDate = dueDate

	dueTime, err := optionalTime(payload.DueTime)
	if err != nil {
		return input, err
	}
	if dueTime != nil && dueDate == nil {
		return input, errors.New("Сначала укажите дату задачи")
	}
	input.DueTime = dueTime

	return input, nil
}

// validateTaskPriority treats an empty value as the default so older clients
// keep working.
func validateTaskPriority(raw string) (string, error) {
	priority := strings.ToLower(strings.TrimSpace(raw))
	switch priority {
	case "":
		return "normal", nil
	case "low", "normal", "high":
		return priority, nil
	default:
		return "", errors.New("Приоритет может быть low, normal или high")
	}
}

// optionalDate parses "YYYY-MM-DD"; an empty value or JSON null means the task
// has no date.
func optionalDate(raw *string) (*time.Time, error) {
	if raw == nil {
		return nil, nil
	}
	value := strings.TrimSpace(*raw)
	if value == "" {
		return nil, nil
	}
	date, err := time.Parse(time.DateOnly, value)
	if err != nil {
		return nil, errors.New("Дата должна быть в формате YYYY-MM-DD")
	}
	return &date, nil
}

// optionalTime parses "HH:MM"; an empty value means the task has no time.
func optionalTime(raw string) (*string, error) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return nil, nil
	}
	if _, err := time.Parse("15:04", value); err != nil {
		return nil, errors.New("Время должно быть в формате HH:MM")
	}
	return &value, nil
}
