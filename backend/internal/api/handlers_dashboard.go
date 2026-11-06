package api

import (
	"net/http"
	"strconv"
	"time"

	"habit/backend/internal/models"
	"habit/backend/internal/store"
)

type dashboardHabit struct {
	ID           int64              `json:"id"`
	Name         string             `json:"name"`
	Description  string             `json:"description"`
	CategoryID   int64              `json:"categoryId"`
	CategoryName string             `json:"categoryName"`
	Completion   *models.Completion `json:"completion"`
	Week         []models.DayStatus `json:"week"`
	Streak       int                `json:"streak"`
	Done30       int                `json:"done30"`
}

type dashboardStats struct {
	Total      int     `json:"total"`
	Done       int     `json:"done"`
	Skipped    int     `json:"skipped"`
	Remaining  int     `json:"remaining"`
	BestStreak int     `json:"bestStreak"`
	Rate30     float64 `json:"rate30"`
}

type dashboardResponse struct {
	Date      string           `json:"date"`
	WeekStart string           `json:"weekStart"`
	WeekEnd   string           `json:"weekEnd"`
	Stats     dashboardStats   `json:"stats"`
	Habits    []dashboardHabit `json:"habits"`
}

func (h *Handler) dashboard(w http.ResponseWriter, r *http.Request) {
	date, err := queryDate(r, "date", today())
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	habits, err := h.store.ListHabits(r.Context(), currentUserID(r), nil)
	if err != nil {
		h.fail(w, err)
		return
	}

	weekStart := startOfWeek(date)
	weekEnd := weekStart.AddDate(0, 0, 6)

	completions, err := h.store.ListCompletions(r.Context(), store.CompletionFilter{
		UserID: currentUserID(r),
		From:   &weekStart,
		To:     &weekEnd,
	})
	if err != nil {
		h.fail(w, err)
		return
	}

	doneDates, err := h.store.ListDoneDates(r.Context(), currentUserID(r))
	if err != nil {
		h.fail(w, err)
		return
	}

	completionByKey := make(map[string]models.Completion, len(completions))
	for _, completion := range completions {
		completionByKey[completionKey(completion.HabitID, completion.Date)] = completion
	}

	doneByHabit := make(map[int64]map[string]bool, len(doneDates))
	for habitID, dates := range doneDates {
		days := make(map[string]bool, len(dates))
		for _, day := range dates {
			days[day.Format(time.DateOnly)] = true
		}
		doneByHabit[habitID] = days
	}

	result := make([]dashboardHabit, 0, len(habits))
	stats := dashboardStats{Total: len(habits)}
	done30Total := 0

	for _, habit := range habits {
		item := dashboardHabit{
			ID:           habit.ID,
			Name:         habit.Name,
			Description:  habit.Description,
			CategoryID:   habit.CategoryID,
			CategoryName: habit.CategoryName,
			Week:         make([]models.DayStatus, 0, 7),
			Streak:       streakOn(doneByHabit[habit.ID], date),
			Done30:       countDoneBetween(doneDates[habit.ID], date.AddDate(0, 0, -29), date),
		}

		for offset := 0; offset < 7; offset++ {
			day := weekStart.AddDate(0, 0, offset)
			dayStatus := models.DayStatus{Date: day.Format(time.DateOnly)}
			if completion, ok := completionByKey[completionKey(habit.ID, dayStatus.Date)]; ok {
				status := completion.Status
				dayStatus.Status = &status
			}
			item.Week = append(item.Week, dayStatus)
		}

		if completion, ok := completionByKey[completionKey(habit.ID, date.Format(time.DateOnly))]; ok {
			completion := completion
			item.Completion = &completion
			switch completion.Status {
			case models.StatusDone:
				stats.Done++
			case models.StatusSkipped:
				stats.Skipped++
			}
		}

		if item.Streak > stats.BestStreak {
			stats.BestStreak = item.Streak
		}
		done30Total += item.Done30

		result = append(result, item)
	}

	stats.Remaining = stats.Total - stats.Done - stats.Skipped
	if len(habits) > 0 {
		stats.Rate30 = round1(float64(done30Total) / float64(len(habits)*30) * 100)
	}

	writeJSON(w, http.StatusOK, dashboardResponse{
		Date:      date.Format(time.DateOnly),
		WeekStart: weekStart.Format(time.DateOnly),
		WeekEnd:   weekEnd.Format(time.DateOnly),
		Stats:     stats,
		Habits:    result,
	})
}

func completionKey(habitID int64, date string) string {
	return strconv.FormatInt(habitID, 10) + "|" + date
}

func startOfWeek(date time.Time) time.Time {
	offset := (int(date.Weekday()) + 6) % 7
	return date.AddDate(0, 0, -offset)
}

func streakOn(doneDays map[string]bool, on time.Time) int {
	if len(doneDays) == 0 {
		return 0
	}

	cursor := on
	if !doneDays[cursor.Format(time.DateOnly)] {
		cursor = cursor.AddDate(0, 0, -1)
	}

	streak := 0
	for doneDays[cursor.Format(time.DateOnly)] {
		streak++
		cursor = cursor.AddDate(0, 0, -1)
	}
	return streak
}

func countDoneBetween(dates []time.Time, from, to time.Time) int {
	count := 0
	for _, date := range dates {
		if !date.Before(from) && !date.After(to) {
			count++
		}
	}
	return count
}
