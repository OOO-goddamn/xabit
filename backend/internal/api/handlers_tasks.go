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
	Title   string  `json:"title"`
	Note    string  `json:"note"`
	DueDate *string `json:"dueDate"`
	Done    bool    `json:"done"`
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

	title, note, dueDate, err := validateTask(payload)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, err.Error())
		return
	}

	task, err := h.store.CreateTask(r.Context(), currentUserID(r), title, note, dueDate)
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

	title, note, dueDate, err := validateTask(payload)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, err.Error())
		return
	}

	task, err := h.store.UpdateTask(r.Context(), currentUserID(r), id, title, note, dueDate, payload.Done)
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

func validateTask(payload taskPayload) (string, string, *time.Time, error) {
	title, err := validateName(payload.Title, "Название задачи", maxTaskTitleLen)
	if err != nil {
		return "", "", nil, err
	}

	note := strings.TrimSpace(payload.Note)
	if len([]rune(note)) > maxTaskNoteLen {
		return "", "", nil, errors.New("Описание не должно быть длиннее 2000 символов")
	}

	dueDate, err := optionalDate(payload.DueDate)
	if err != nil {
		return "", "", nil, err
	}
	return title, note, dueDate, nil
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
