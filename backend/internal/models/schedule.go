package models

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
		for _, day := range s.Weekdays {
			if day == iso {
				return true
			}
		}
		return false
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
