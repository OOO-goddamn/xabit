package api

import (
	"testing"

	"habit/backend/internal/models"
)

func quantityHabit(target int) models.Habit {
	return models.Habit{TargetValue: &target}
}

func TestQuantityStatus(t *testing.T) {
	habit := quantityHabit(60)

	tests := []struct {
		name      string
		requested string
		raw       *int
		want      string
		wantValue int
		wantError bool
	}{
		{"partial progress", "", intPtr(30), models.StatusProgress, 30, false},
		{"exact target", "", intPtr(60), models.StatusDone, 60, false},
		{"over target keeps value", models.StatusProgress, intPtr(90), models.StatusDone, 90, false},
		{"done without amount means target", models.StatusDone, nil, models.StatusDone, 60, false},
		{"skip clears amount", models.StatusSkipped, intPtr(30), models.StatusSkipped, 0, false},
		{"zero clears mark", "", intPtr(0), "", 0, false},
		{"negative value rejected", "", intPtr(-5), "", 0, true},
		{"unknown status rejected", "weird", intPtr(10), "", 0, true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			status, value, err := quantityStatus(habit, test.requested, test.raw)
			if test.wantError {
				if err == nil {
					t.Fatal("expected an error")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if status != test.want || value != test.wantValue {
				t.Fatalf("quantityStatus() = %q, %d; want %q, %d", status, value, test.want, test.wantValue)
			}
		})
	}
}

func TestNormalizeTarget(t *testing.T) {
	target, unit, step, err := normalizeTarget(nil, "мин", 5)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if target != nil || unit != "" || step != 1 {
		t.Fatalf("binary habit normalized to %v, %q, %d", target, unit, step)
	}

	target, unit, step, err = normalizeTarget(intPtr(60), " мин ", 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if target == nil || *target != 60 || unit != "мин" || step != 1 {
		t.Fatalf("quantity habit normalized to %v, %q, %d", target, unit, step)
	}

	if _, _, _, err := normalizeTarget(intPtr(0), "", 0); err != nil {
		t.Fatalf("zero target should fall back to binary: %v", err)
	}
	if _, _, _, err := normalizeTarget(intPtr(1_000_001), "", 1); err == nil {
		t.Fatal("expected a target limit error")
	}
	if _, _, _, err := normalizeTarget(intPtr(10), "очень длинная единица измерения", 1); err == nil {
		t.Fatal("expected a unit length error")
	}
}

func TestDisplayValue(t *testing.T) {
	quantity := quantityHabit(60)

	if got := displayValue(models.Completion{Status: models.StatusDone}, quantity); got != 60 {
		t.Fatalf("old done row displayed as %d, want target 60", got)
	}
	if got := displayValue(models.Completion{Status: models.StatusProgress, Value: 30}, quantity); got != 30 {
		t.Fatalf("progress row displayed as %d, want 30", got)
	}
	if got := displayValue(models.Completion{Status: models.StatusDone, Value: 90}, quantity); got != 90 {
		t.Fatalf("overshoot displayed as %d, want 90", got)
	}

	binary := models.Habit{}
	if got := displayValue(models.Completion{Status: models.StatusDone}, binary); got != 0 {
		t.Fatalf("binary habit displayed as %d, want 0", got)
	}
}

func intPtr(value int) *int {
	return &value
}
