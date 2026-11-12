package models

import "time"

const (
	StatusDone     = "done"
	StatusSkipped  = "skipped"
	StatusProgress = "progress"
)

type Category struct {
	ID         int64  `json:"id"`
	Name       string `json:"name"`
	HabitCount int    `json:"habitCount"`
}

type User struct {
	ID           int64     `json:"id"`
	Email        string    `json:"email"`
	Name         string    `json:"name"`
	PasswordHash string    `json:"-"`
	CreatedAt    time.Time `json:"createdAt"`
}

type Habit struct {
	ID           int64     `json:"id"`
	Name         string    `json:"name"`
	Description  string    `json:"description"`
	CategoryID   int64     `json:"categoryId"`
	CategoryName string    `json:"categoryName"`
	ReminderTime string    `json:"reminderTime"`
	TargetValue  *int      `json:"targetValue"`
	Unit         string    `json:"unit"`
	StepValue    int       `json:"stepValue"`
	CreatedAt    time.Time `json:"createdAt"`
	Schedule
}

// IsQuantity reports whether the habit tracks an amount instead of a plain
// done/skipped mark.
func (h Habit) IsQuantity() bool {
	return h.TargetValue != nil && *h.TargetValue > 0
}

type Completion struct {
	ID      int64  `json:"id"`
	HabitID int64  `json:"habitId"`
	Date    string `json:"date"`
	Status  string `json:"status"`
	Value   int    `json:"value"`
	Note    string `json:"note"`
}

type DayStatus struct {
	Date    string  `json:"date"`
	Status  *string `json:"status"`
	Due     bool    `json:"due"`
	Covered bool    `json:"covered"`
	Value   int     `json:"value"`
}
