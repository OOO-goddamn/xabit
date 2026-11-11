package api

import (
	"testing"
	"time"

	"habit/backend/internal/models"
)

func testDay(value string) time.Time {
	parsed, err := time.Parse(time.DateOnly, value)
	if err != nil {
		panic(err)
	}
	return parsed
}

func TestCoveredOn(t *testing.T) {
	schedule := models.Schedule{Repeat: "weekly", Weekdays: []int{1, 3}}
	done := map[string]bool{
		"2026-11-09": true, // Monday
		"2026-11-11": true, // Wednesday
	}

	tests := []struct {
		name string
		date string
		want bool
	}{
		{"off-day after done monday", "2026-11-10", true},
		{"off-day after done wednesday", "2026-11-12", true},
		{"due day is never covered", "2026-11-11", false},
		{"off-day after missed wednesday", "2026-11-19", false},
		{"due monday is not covered", "2026-11-16", false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := coveredOn(testDay(test.date), schedule, done); got != test.want {
				t.Fatalf("coveredOn(%s) = %v, want %v", test.date, got, test.want)
			}
		})
	}
}

func TestCoveredOnDailySchedule(t *testing.T) {
	schedule := models.Schedule{Repeat: "daily"}
	if coveredOn(testDay("2026-11-11"), schedule, map[string]bool{"2026-11-10": true}) {
		t.Fatal("daily habits have no off-days to cover")
	}
}
