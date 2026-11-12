package models

import "slices"

import "time"

// Schedule describes when a habit is expected to be done.
//
// Repeat is "daily", "weekly" or "monthly". Weekdays holds ISO weekday
// numbers (1 = Monday ... 7 = Sunday) for weekly habits, and MonthDay holds
// the day of month for monthly habits.
type Schedule struct {
	Repeat   string `json:"repeat"`
	Weekdays []int  `json:"weekdays"`
	MonthDay *int   `json:"monthDay"`
}

// DueOn reports whether the habit is planned for the given day.
func (s Schedule) DueOn(date time.Time) bool {
	switch s.Repeat {
	case "weekly":
		iso := int(date.Weekday())
		if iso == 0 {
			iso = 7
		}
		return slices.Contains(s.Weekdays, iso)
	case "monthly":
		if s.MonthDay == nil {
			return true
		}
		day := date.Day()
		last := daysInMonth(date)
		if day == *s.MonthDay {
			return true
		}
		// 29-31 has no such day in every month: fall back to the last day.
		return *s.MonthDay > last && day == last
	default:
		return true
	}
}

// PreviousDue returns the latest planned day strictly before date. The lookup
// is bounded by a year, which is well above the longest gap between planned
// days (daily: 1, weekly: 7, monthly: at most 31).
func (s Schedule) PreviousDue(date time.Time) (time.Time, bool) {
	for offset := 1; offset <= 370; offset++ {
		cursor := date.AddDate(0, 0, -offset)
		if s.DueOn(cursor) {
			return cursor, true
		}
	}
	return time.Time{}, false
}

// DueCountBetween counts the planned days in the inclusive [from, to] range.
func (s Schedule) DueCountBetween(from, to time.Time) int {
	count := 0
	for cursor := from; !cursor.After(to); cursor = cursor.AddDate(0, 0, 1) {
		if s.DueOn(cursor) {
			count++
		}
	}
	return count
}

func daysInMonth(date time.Time) int {
	return time.Date(date.Year(), date.Month()+1, 0, 0, 0, 0, 0, time.UTC).Day()
}
