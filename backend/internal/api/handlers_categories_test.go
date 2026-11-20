package api

import "testing"

func TestCategoryAppearance(t *testing.T) {
	tests := []struct {
		name      string
		icon      string
		color     string
		defaults  bool
		wantIcon  string
		wantColor string
		wantErr   bool
	}{
		{name: "defaults for old clients", defaults: true, wantIcon: "tag", wantColor: "#1d5c48"},
		{name: "valid custom values", icon: "heart", color: "#C49A4A", defaults: true, wantIcon: "heart", wantColor: "#c49a4a"},
		{name: "missing values on update preserve stored values", defaults: false},
		{name: "partial update", icon: "book", defaults: false, wantIcon: "book"},
		{name: "unsupported icon", icon: "unknown", color: "#1d5c48", defaults: true, wantErr: true},
		{name: "invalid color", icon: "tag", color: "green", defaults: true, wantErr: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			icon, color, err := categoryAppearance(test.icon, test.color, test.defaults)
			if (err != nil) != test.wantErr {
				t.Fatalf("categoryAppearance() error = %v, wantErr %v", err, test.wantErr)
			}
			if err == nil && (icon != test.wantIcon || color != test.wantColor) {
				t.Fatalf("categoryAppearance() = (%q, %q), want (%q, %q)", icon, color, test.wantIcon, test.wantColor)
			}
		})
	}
}

func TestValidateOrderIDs(t *testing.T) {
	tests := []struct {
		name    string
		ids     []int64
		wantErr bool
	}{
		{name: "empty list", ids: []int64{}},
		{name: "valid IDs", ids: []int64{3, 1, 2}},
		{name: "zero ID", ids: []int64{1, 0}, wantErr: true},
		{name: "duplicate ID", ids: []int64{1, 2, 1}, wantErr: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := validateOrderIDs(test.ids)
			if (err != nil) != test.wantErr {
				t.Fatalf("validateOrderIDs() error = %v, wantErr %v", err, test.wantErr)
			}
		})
	}
}
