package api

import (
	"net/http"
	"strconv"
	"time"

	"habit/backend/internal/models"
	"habit/backend/internal/store"
)

type statsTotals struct {
	Done     int     `json:"done"`
	Skipped  int     `json:"skipped"`
	Possible int     `json:"possible"`
	Rate     float64 `json:"rate"`
}

type statsDay struct {
	Date     string  `json:"date"`
	Done     int     `json:"done"`
	Skipped  int     `json:"skipped"`
	Possible int     `json:"possible"`
	Rate     float64 `json:"rate"`
}

type statsHabit struct {
	ID           int64              `json:"id"`
	Name         string             `json:"name"`
	CategoryName string             `json:"categoryName"`
	Done         int                `json:"done"`
	Skipped      int                `json:"skipped"`
	Rate         float64            `json:"rate"`
	Streak       int                `json:"streak"`
	History      []models.DayStatus `json:"history"`
}

type statsResponse struct {
	From   string       `json:"from"`
	To     string       `json:"to"`
	Days   int          `json:"days"`
	Totals statsTotals  `json:"totals"`
	Daily  []statsDay   `json:"daily"`
	Habits []statsHabit `json:"habits"`
}

func (h *Handler) stats(w http.ResponseWriter, r *http.Request) {
	to, err := queryDate(r, "to", today())
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	days := 30
	if raw := r.URL.Query().Get("days"); raw != "" {
		days, err = strconv.Atoi(raw)
		if err != nil || days < 1 || days > 180 {
			writeError(w, http.StatusBadRequest, "days должен быть числом от 1 до 180")
			return
		}
	}

	from := to.AddDate(0, 0, -(days - 1))

	habits, err := h.store.ListHabits(r.Context(), currentUserID(r), nil)
	if err != nil {
		h.fail(w, err)
		return
	}

	completions, err := h.store.ListCompletions(r.Context(), store.CompletionFilter{
		UserID: currentUserID(r),
		From:   &from,
		To:     &to,
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

	statusByHabit := make(map[int64]map[string]string, len(habits))
	for _, completion := range completions {
		if statusByHabit[completion.HabitID] == nil {
			statusByHabit[completion.HabitID] = make(map[string]string)
		}
		statusByHabit[completion.HabitID][completion.Date] = completion.Status
	}

	daily := make([]statsDay, 0, days)
	dailyIndex := make(map[string]int, days)
	for offset := 0; offset < days; offset++ {
		date := from.AddDate(0, 0, offset)
		key := date.Format(time.DateOnly)
		dailyIndex[key] = len(daily)
		daily = append(daily, statsDay{Date: key})
	}

	habitStats := make([]statsHabit, 0, len(habits))
	totals := statsTotals{}

	for _, habit := range habits {
		item := statsHabit{
			ID:           habit.ID,
			Name:         habit.Name,
			CategoryName: habit.CategoryName,
			History:      make([]models.DayStatus, 0, days),
			Streak:       streakOn(dateSet(doneDates[habit.ID]), to, habit.Schedule),
		}

		statuses := statusByHabit[habit.ID]
		for offset := 0; offset < days; offset++ {
			date := from.AddDate(0, 0, offset)
			key := date.Format(time.DateOnly)
			due := habit.DueOn(date)
			dayStatus := models.DayStatus{Date: key, Due: due}

			if due {
				totals.Possible++
				daily[dailyIndex[key]].Possible++
			}

			if status, ok := statuses[key]; ok {
				status := status
				dayStatus.Status = &status
				if due {
					switch status {
					case models.StatusDone:
						item.Done++
						totals.Done++
						daily[dailyIndex[key]].Done++
					case models.StatusSkipped:
						item.Skipped++
						totals.Skipped++
						daily[dailyIndex[key]].Skipped++
					}
				}
			}

			item.History = append(item.History, dayStatus)
		}

		dueDays := habit.DueCountBetween(from, to)
		if dueDays > 0 {
			item.Rate = round1(float64(item.Done) / float64(dueDays) * 100)
		}

		habitStats = append(habitStats, item)
	}

	for index := range daily {
		if daily[index].Possible > 0 {
			daily[index].Rate = round1(float64(daily[index].Done) / float64(daily[index].Possible) * 100)
		}
	}

	if totals.Possible > 0 {
		totals.Rate = round1(float64(totals.Done) / float64(totals.Possible) * 100)
	}

	writeJSON(w, http.StatusOK, statsResponse{
		From:   from.Format(time.DateOnly),
		To:     to.Format(time.DateOnly),
		Days:   days,
		Totals: totals,
		Daily:  daily,
		Habits: habitStats,
	})
}

func dateSet(dates []time.Time) map[string]bool {
	set := make(map[string]bool, len(dates))
	for _, date := range dates {
		set[date.Format(time.DateOnly)] = true
	}
	return set
}
