package api

import (
	"encoding/base64"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	maxPushEndpointLen = 2048
	maxPushKeyLen      = 1024
	maxTimezoneLen     = 64
)

type pushKeysPayload struct {
	P256DH string `json:"p256dh"`
	Auth   string `json:"auth"`
}

type pushSubscriptionPayload struct {
	Endpoint string          `json:"endpoint"`
	Keys     pushKeysPayload `json:"keys"`
	Timezone string          `json:"timezone"`
}

type pushEndpointPayload struct {
	Endpoint string `json:"endpoint"`
}

func (h *Handler) pushConfig(w http.ResponseWriter, _ *http.Request) {
	enabled := h.push != nil && h.push.Enabled()
	publicKey := ""
	if h.push != nil {
		publicKey = h.push.PublicKey()
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"enabled":   enabled,
		"publicKey": publicKey,
	})
}

func (h *Handler) savePushSubscription(w http.ResponseWriter, r *http.Request) {
	var payload pushSubscriptionPayload
	if err := decodeJSON(w, r, &payload); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	endpoint := strings.TrimSpace(payload.Endpoint)
	if !validPushEndpoint(endpoint) {
		writeError(w, http.StatusUnprocessableEntity, "Некорректный адрес push-подписки")
		return
	}

	p256dh := strings.TrimSpace(payload.Keys.P256DH)
	auth := strings.TrimSpace(payload.Keys.Auth)
	if !validPushKey(p256dh) || !validPushKey(auth) {
		writeError(w, http.StatusUnprocessableEntity, "Некорректные ключи push-подписки")
		return
	}

	timezone := strings.TrimSpace(payload.Timezone)
	if timezone == "" {
		timezone = "UTC"
	}
	if len(timezone) > maxTimezoneLen {
		writeError(w, http.StatusUnprocessableEntity, "Некорректный часовой пояс")
		return
	}
	if _, err := time.LoadLocation(timezone); err != nil {
		writeError(w, http.StatusUnprocessableEntity, "Некорректный часовой пояс")
		return
	}

	if err := h.store.SavePushSubscription(r.Context(), currentUserID(r), endpoint, p256dh, auth, timezone); err != nil {
		h.fail(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) deletePushSubscription(w http.ResponseWriter, r *http.Request) {
	var payload pushEndpointPayload
	if err := decodeJSON(w, r, &payload); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	endpoint := strings.TrimSpace(payload.Endpoint)
	if endpoint == "" {
		writeError(w, http.StatusUnprocessableEntity, "Не указан адрес push-подписки")
		return
	}

	if err := h.store.DeletePushSubscription(r.Context(), currentUserID(r), endpoint); err != nil {
		h.fail(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) testPush(w http.ResponseWriter, r *http.Request) {
	if h.push == nil || !h.push.Enabled() {
		writeError(w, http.StatusBadRequest, "Push-уведомления не настроены на сервере")
		return
	}

	sent, err := h.push.SendTest(r.Context(), currentUserID(r))
	if err != nil {
		writeError(w, http.StatusBadGateway, "Не удалось отправить push-уведомление")
		return
	}
	if sent == 0 {
		writeError(w, http.StatusConflict, "Нет активных подписок. Включите push-уведомления в этом браузере")
		return
	}

	writeJSON(w, http.StatusOK, map[string]int{"sent": sent})
}

func validPushEndpoint(endpoint string) bool {
	if endpoint == "" || len(endpoint) > maxPushEndpointLen {
		return false
	}

	parsed, err := url.Parse(endpoint)
	if err != nil {
		return false
	}
	return parsed.Scheme == "https" && parsed.Host != ""
}

func validPushKey(value string) bool {
	if value == "" || len(value) > maxPushKeyLen {
		return false
	}

	trimmed := strings.TrimRight(value, "=")
	decoded, err := base64.RawURLEncoding.DecodeString(trimmed)
	return err == nil && len(decoded) > 0
}
