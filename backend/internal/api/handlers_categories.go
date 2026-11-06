package api

import "net/http"

type categoryPayload struct {
	Name string `json:"name"`
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

	category, err := h.store.CreateCategory(r.Context(), currentUserID(r), name)
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

	category, err := h.store.UpdateCategory(r.Context(), currentUserID(r), id, name)
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
