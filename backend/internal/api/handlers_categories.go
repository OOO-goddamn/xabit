package api

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
)

type categoryPayload struct {
	Name  string `json:"name"`
	Icon  string `json:"icon"`
	Color string `json:"color"`
}

func (h *Handler) listCategories(w http.ResponseWriter, r *http.Request) {
	categories, err := h.store.ListCategories(r.Context(), currentUserID(r))
	if err != nil {
		h.fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, categories)
}

func (h *Handler) createCategory(w http.ResponseWriter, r *http.Request) {
	var payload categoryPayload
	if err := decodeJSON(w, r, &payload); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	name, err := validateName(payload.Name, "РќР°Р·РІР°РЅРёРµ РєР°С‚РµРіРѕСЂРёРё", maxCategoryNameLen)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, err.Error())
		return
	}
	icon, color, err := categoryAppearance(payload.Icon, payload.Color, true)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, err.Error())
		return
	}

	category, err := h.store.CreateCategory(r.Context(), currentUserID(r), name, icon, color)
	if err != nil {
		h.fail(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, category)
}

func (h *Handler) updateCategory(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	var payload categoryPayload
	if err := decodeJSON(w, r, &payload); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	name, err := validateName(payload.Name, "РќР°Р·РІР°РЅРёРµ РєР°С‚РµРіРѕСЂРёРё", maxCategoryNameLen)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, err.Error())
		return
	}
	icon, color, err := categoryAppearance(payload.Icon, payload.Color, false)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, err.Error())
		return
	}

	category, err := h.store.UpdateCategory(r.Context(), currentUserID(r), id, name, icon, color)
	if err != nil {
		h.fail(w, err)
		return
	}
	writeJSON(w, http.StatusOK, category)
}

func (h *Handler) deleteCategory(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	if err := h.store.DeleteCategory(r.Context(), currentUserID(r), id); err != nil {
		h.fail(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func categoryAppearance(icon, color string, defaults bool) (string, string, error) {
	icon = strings.TrimSpace(icon)
	color = strings.ToLower(strings.TrimSpace(color))

	if icon == "" && defaults {
		icon = "tag"
	}
	if color == "" && defaults {
		color = "#1d5c48"
	}
	if icon != "" && !validCategoryIcon(icon) {
		return "", "", errors.New("Выберите значок из списка")
	}
	if color != "" {
		if len(color) != 7 || color[0] != '#' {
			return "", "", errors.New("Цвет должен быть в формате #RRGGBB")
		}
		if _, err := strconv.ParseUint(color[1:], 16, 24); err != nil {
			return "", "", errors.New("Цвет должен быть в формате #RRGGBB")
		}
	}
	return icon, color, nil
}

func validCategoryIcon(icon string) bool {
	switch icon {
	case "tag", "heart", "activity", "book", "briefcase", "dumbbell", "apple", "brain", "home", "wallet", "sparkles", "sun", "leaf", "education", "target", "coffee":
		return true
	default:
		return false
	}
}
