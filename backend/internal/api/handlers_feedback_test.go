package api

import (
	"strings"
	"testing"
)

func TestValidateFeedback(t *testing.T) {
	tests := []struct {
		name    string
		kind    string
		message string
		wantErr bool
	}{
		{name: "idea", kind: "idea", message: "Добавьте календарь"},
		{name: "bug", kind: "bug", message: "Не сохраняется отметка"},
		{name: "unsupported kind", kind: "urgent", message: "Текст", wantErr: true},
		{name: "empty message", kind: "other", message: "  ", wantErr: true},
		{name: "message too long", kind: "idea", message: strings.Repeat("я", maxFeedbackMessageLen+1), wantErr: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := validateFeedback(test.kind, strings.TrimSpace(test.message))
			if (err != nil) != test.wantErr {
				t.Fatalf("validateFeedback() error = %v, wantErr %v", err, test.wantErr)
			}
		})
	}
}

func TestFeedbackAdminAllowed(t *testing.T) {
	tests := []struct {
		name      string
		admin     string
		user      string
		wantAllow bool
	}{
		{name: "matching address", admin: "admin@example.com", user: "admin@example.com", wantAllow: true},
		{name: "case insensitive", admin: "Admin@Example.com", user: "admin@example.com", wantAllow: true},
		{name: "different account", admin: "admin@example.com", user: "other@example.com"},
		{name: "not configured", user: "admin@example.com"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := feedbackAdminAllowed(test.admin, test.user); got != test.wantAllow {
				t.Fatalf("feedbackAdminAllowed() = %v, want %v", got, test.wantAllow)
			}
		})
	}
}
