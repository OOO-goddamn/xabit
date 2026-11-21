package api

import "testing"

func TestOptionalDate(t *testing.T) {
	empty := ""
	blank := "   "
	valid := "2026-11-21"
	invalid := "21.11.2026"

	tests := []struct {
		name    string
		raw     *string
		want    string
		wantErr bool
	}{
		{name: "missing value means no date", raw: nil},
		{name: "empty string means no date", raw: &empty},
		{name: "blank string means no date", raw: &blank},
		{name: "valid date", raw: &valid, want: "2026-11-21"},
		{name: "invalid date", raw: &invalid, wantErr: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			date, err := optionalDate(test.raw)
			if (err != nil) != test.wantErr {
				t.Fatalf("optionalDate() error = %v, wantErr %v", err, test.wantErr)
			}
			if err == nil {
				got := ""
				if date != nil {
					got = date.Format("2006-01-02")
				}
				if got != test.want {
					t.Fatalf("optionalDate() = %q, want %q", got, test.want)
				}
			}
		})
	}
}
