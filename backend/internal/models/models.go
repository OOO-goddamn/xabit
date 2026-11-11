package models

import "time"

const (
	StatusDone    = "done"
	StatusSkipped = "skipped"
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
	CreatedAt    time.Time `json:"createdAt"`
	Schedule
}

type Completion struct {
	ID      int64  `json:"id"`
	HabitID int64  `json:"habitId"`
	Date    string `json:"date"`
	Status  string `json:"status"`
	Note    string `json:"note"`
}

type DayStatus struct {
	Date   string  `json:"date"`
	Status *string `json:"status"`
	Due    bool    `json:"due"`
}
