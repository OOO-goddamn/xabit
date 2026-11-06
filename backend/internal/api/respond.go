package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

const (
	maxBodyBytes       = 1 << 20 // 1 MiB
	maxCategoryNameLen = 80
	maxHabitNameLen    = 120
	maxDescriptionLen  = 2000
	maxNoteLen         = 2000
)

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)

	if payload == nil {
		return
	}
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		// The response is already written, nothing useful can be done here.
		return
	}
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func decodeJSON(w http.ResponseWriter, r *http.Request, dst any) error {
	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)

	decoder := json.NewDecoder(r.Body)
	if err := decoder.Decode(dst); err != nil {
		if errors.Is(err, io.EOF) {
			return errors.New("тело запроса пустое")
		}
		if strings.Contains(err.Error(), "request body too large") {
			return errors.New("тело запроса слишком большое")
		}
		return fmt.Errorf("некорректный JSON: %w", err)
	}

	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return errors.New("в теле запроса должен быть один JSON-объект")
	}

	return nil
}

func parseID(r *http.Request) (int64, error) {
	raw := r.PathValue("id")
	id, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || id <= 0 {
		return 0, fmt.Errorf("некорректный идентификатор %q", raw)
	}
	return id, nil
}

func optionalID(raw string) (*int64, error) {
	if raw == "" {
		return nil, nil
	}
	id, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || id <= 0 {
		return nil, fmt.Errorf("некорректный идентификатор %q", raw)
	}
	return &id, nil
}

func today() time.Time {
	now := time.Now()
	return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
}

func queryDate(r *http.Request, key string, fallback time.Time) (time.Time, error) {
	raw := strings.TrimSpace(r.URL.Query().Get(key))
	if raw == "" {
		return fallback, nil
	}
	date, err := time.Parse(time.DateOnly, raw)
	if err != nil {
		return time.Time{}, fmt.Errorf("%s должен быть в формате YYYY-MM-DD", key)
	}
	return date, nil
}

func validateName(value, field string, maxLen int) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return "", fmt.Errorf("%s не может быть пустым", field)
	}
	if len([]rune(value)) > maxLen {
		return "", fmt.Errorf("%s не должен быть длиннее %d символов", field, maxLen)
	}
	return value, nil
}

func round1(value float64) float64 {
	return float64(int(value*10+0.5)) / 10
}
