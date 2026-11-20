package api

import (
	"errors"
	"net/http"
)

const maxSortableItems = 1000

type categoryOrderPayload struct {
	IDs []int64 `json:"ids"`
}

type habitOrderPayload struct {
	CategoryID int64   `json:"categoryId"`
	IDs        []int64 `json:"ids"`
}

func (h *Handler) reorderCategories(w http.ResponseWriter, r *http.Request) {
	var payload categoryOrderPayload
	if err := decodeJSON(w, r, &payload); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := validateOrderIDs(payload.IDs); err != nil {
		writeError(w, http.StatusUnprocessableEntity, err.Error())
		return
	}
	if err := h.store.ReorderCategories(r.Context(), currentUserID(r), payload.IDs); err != nil {
		h.fail(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) reorderHabits(w http.ResponseWriter, r *http.Request) {
	var payload habitOrderPayload
	if err := decodeJSON(w, r, &payload); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if payload.CategoryID <= 0 {
		writeError(w, http.StatusUnprocessableEntity, "Не указана категория")
		return
	}
	if err := validateOrderIDs(payload.IDs); err != nil {
		writeError(w, http.StatusUnprocessableEntity, err.Error())
		return
	}
	if err := h.store.ReorderHabits(r.Context(), currentUserID(r), payload.CategoryID, payload.IDs); err != nil {
		h.fail(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func validateOrderIDs(ids []int64) error {
	if len(ids) > maxSortableItems {
		return errors.New("Слишком много элементов в списке")
	}
	seen := make(map[int64]struct{}, len(ids))
	for _, id := range ids {
		if id <= 0 {
			return errors.New("Некорректный идентификатор")
		}
		if _, exists := seen[id]; exists {
			return errors.New("В списке есть повторяющиеся элементы")
		}
		seen[id] = struct{}{}
	}
	return nil
}
