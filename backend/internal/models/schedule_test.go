package models

import (
	"testing"
	"time"
)

func day(value string) time.Time {
	parsed, err := time.Parse(time.DateOnly, value)
	if err != nil {
		panic(err)
	}
	return parsed
}

func intPtr(value int) *int {
	return &value
}

func TestScheduleDueOn(t *testing.T) {
	tests := []struct {
		name     string
		schedule Schedule
		date     string
		want     bool
	}{
		{"daily", Schedule{Repeat: "daily"}, "2026-11-11", true},
		{"weekly monday", Schedule{Repeat: "weekly", Weekdays: []int{1, 3}}, "2026-11-11", true},
		{"weekly friday", Schedule{Repeat: "weekly", Weekdays: []int{1, 3}}, "2026-11-13", false},
		{"weekly sunday", Schedule{Repeat: "weekly", Weekdays: []int{7}}, "2026-11-15", true},
		{"monthly matching", Schedule{Repeat: "monthly", MonthDay: intPtr(15)}, "2026-11-15", true},
		{"monthly other day", Schedule{Repeat: "monthly", MonthDay: intPtr(15)}, "2026-11-16", false},
		{"monthly 31 in february", Schedule{Repeat: "monthly", MonthDay: intPtr(31)}, "2026-02-28", true},
		{"monthly 31 in february non-last", Schedule{Repeat: "monthly", MonthDay: intPtr(31)}, "2026-02-27", false},
		{"monthly 31 in leap february", Schedule{Repeat: "monthly", MonthDay: intPtr(31)}, "2028-02-29", true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := test.schedule.DueOn(day(test.date)); got != test.want {
				t.Fatalf("DueOn(%s) = %v, want %v", test.date, got, test.want)
			}
		})
	}
}

func TestScheduleDueCountBetween(t *testing.T) {
	schedule := Schedule{Repeat: "weekly", Weekdays: []int{1, 3}}

	// 2026-11-09 (Mon) .. 2026-11-15 (Sun) contains Monday and Wednesday.
	if got := schedule.DueCountBetween(day("2026-11-09"), day("2026-11-15")); got != 2 {
		t.Fatalf("DueCountBetween() = %d, want 2", got)
	}

	monthly := Schedule{Repeat: "monthly", MonthDay: intPtr(15)}
	if got := monthly.DueCountBetween(day("2026-01-01"), day("2026-03-31")); got != 3 {
		t.Fatalf("monthly DueCountBetween() = %d, want 3", got)
	}
}
