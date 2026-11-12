// Package push delivers habit reminders with the Web Push protocol.
//
// It runs inside the API process: every 30 seconds it looks for habits whose
// reminder time has just arrived in the subscription's local timezone, skips
// habits already marked for that day and sends an encrypted push message with
// VAPID authentication. The browser shows it from the service worker, so the
// tab does not need to be open.
package push

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"
	_ "time/tzdata" // Keep IANA timezones working in the minimal Alpine image.

	webpush "github.com/SherClockHolmes/webpush-go"

	"habit/backend/internal/store"
)

const (
	checkInterval  = 30 * time.Second
	dueWindow      = 5 * time.Minute
	sendTimeout    = 15 * time.Second
	messageTTL     = 3600 // seconds the push service keeps an undelivered message
	cleanupEvery   = 6 * time.Hour
	retentionDays  = 7
	maxBodyRunes   = 180
	defaultSubject = "mailto:admin@example.com"
)

// Config carries the VAPID credentials and the frontend URL.
type Config struct {
	PublicKey  string
	PrivateKey string
	Subject    string
	AppURL     string
}

// Payload is the JSON body understood by frontend/public/sw.js.
type Payload struct {
	Title string `json:"title"`
	Body  string `json:"body"`
	URL   string `json:"url"`
	Tag   string `json:"tag"`
}

// Service sends pushes and owns the reminder scheduler.
type Service struct {
	store  *store.Store
	cfg    Config
	client *http.Client
	logger *slog.Logger
}

func New(st *store.Store, cfg Config) *Service {
	if strings.TrimSpace(cfg.Subject) == "" {
		cfg.Subject = defaultSubject
	}
	if strings.TrimSpace(cfg.AppURL) == "" {
		cfg.AppURL = "http://localhost:3000"
	}

	return &Service{
		store:  st,
		cfg:    cfg,
		client: &http.Client{Timeout: sendTimeout},
		logger: slog.Default(),
	}
}

// Enabled reports whether both VAPID keys are configured.
func (s *Service) Enabled() bool {
	return strings.TrimSpace(s.cfg.PublicKey) != "" && strings.TrimSpace(s.cfg.PrivateKey) != ""
}

func (s *Service) PublicKey() string {
	return s.cfg.PublicKey
}

// Run blocks until the context is cancelled. It is a no-op without VAPID keys.
func (s *Service) Run(ctx context.Context) {
	if !s.Enabled() {
		s.logger.Info("push reminders disabled: VAPID keys are not set")
		return
	}

	s.logger.Info("push reminder scheduler started", "interval", checkInterval.String())
	ticker := time.NewTicker(checkInterval)
	defer ticker.Stop()

	lastCleanup := time.Time{}
	s.check(ctx, time.Now())
	lastCleanup = time.Now()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			now := time.Now()
			s.check(ctx, now)
			if now.Sub(lastCleanup) >= cleanupEvery {
				s.cleanup(ctx, now)
				lastCleanup = now
			}
		}
	}
}

func (s *Service) check(ctx context.Context, now time.Time) {
	if ctx.Err() != nil {
		return
	}

	candidates, err := s.store.PushReminderCandidates(ctx)
	if err != nil {
		s.logger.Error("load push reminders failed", "error", err)
		return
	}

	for _, candidate := range candidates {
		timezone := strings.TrimSpace(candidate.Subscription.Timezone)
		if timezone == "" {
			timezone = "UTC"
		}

		location, err := time.LoadLocation(timezone)
		if err != nil {
			s.logger.Warn("unknown push timezone, falling back to UTC",
				"timezone", timezone,
				"subscription", candidate.Subscription.ID,
			)
			location = time.UTC
		}

		localNow := now.In(location)
		target, due := reminderDue(candidate.ReminderTime, localNow)
		if !due {
			continue
		}
		if !candidate.Schedule.DueOn(target) {
			continue
		}
		date := target.Format(time.DateOnly)

		settled, err := s.store.CompletionSettled(ctx, candidate.HabitID, date)
		if err != nil {
			s.logger.Error("check completion failed",
				"habit", candidate.HabitID, "date", date, "error", err)
			continue
		}
		if settled {
			continue
		}

		claimed, err := s.store.ClaimReminderDelivery(ctx, candidate.Subscription.ID, candidate.HabitID, date)
		if err != nil {
			s.logger.Error("claim reminder failed",
				"habit", candidate.HabitID, "date", date, "error", err)
			continue
		}
		if !claimed {
			continue
		}

		payload := Payload{
			Title: "Пора: " + candidate.HabitName,
			Body:  notificationBody(candidate.HabitDescription, candidate.ReminderTime),
			URL:   s.appURL(),
			Tag:   fmt.Sprintf("habit-reminder-%d", candidate.HabitID),
		}

		if err := s.send(ctx, candidate.Subscription, payload); err != nil {
			s.logger.Warn("push delivery failed",
				"habit", candidate.HabitID,
				"subscription", candidate.Subscription.ID,
				"error", err,
			)
			// Let the next tick inside the due window retry, unless the
			// subscription itself was removed as expired.
			if releaseErr := s.store.ReleaseReminderDelivery(ctx, candidate.Subscription.ID, candidate.HabitID, date); releaseErr != nil {
				s.logger.Warn("release reminder delivery failed", "error", releaseErr)
			}
			continue
		}

		s.logger.Info("push reminder sent",
			"habit", candidate.HabitID,
			"habit_name", candidate.HabitName,
			"subscription", candidate.Subscription.ID,
			"date", date,
			"timezone", timezone,
		)
	}
}

// SendTest pushes a notification to every device of the user and returns the
// number of successful deliveries.
func (s *Service) SendTest(ctx context.Context, userID int64) (int, error) {
	if !s.Enabled() {
		return 0, errors.New("push disabled")
	}

	subscriptions, err := s.store.PushSubscriptionsByUser(ctx, userID)
	if err != nil {
		return 0, err
	}
	if len(subscriptions) == 0 {
		return 0, nil
	}

	payload := Payload{
		Title: "привычка",
		Body:  "Push-уведомления работают. Напоминания придут, даже если вкладка закрыта.",
		URL:   s.appURL(),
		Tag:   "habit-push-test",
	}

	sent := 0
	var lastErr error
	for _, subscription := range subscriptions {
		if err := s.send(ctx, subscription, payload); err != nil {
			lastErr = err
			s.logger.Warn("push test failed",
				"subscription", subscription.ID,
				"error", err,
			)
			continue
		}
		sent++
	}

	if sent == 0 && lastErr != nil {
		return 0, lastErr
	}
	return sent, nil
}

func (s *Service) send(ctx context.Context, subscription store.PushSubscription, payload Payload) error {
	message, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	requestCtx, cancel := context.WithTimeout(ctx, sendTimeout)
	defer cancel()

	response, err := webpush.SendNotificationWithContext(requestCtx, message,
		&webpush.Subscription{
			Endpoint: subscription.Endpoint,
			Keys: webpush.Keys{
				Auth:   subscription.Auth,
				P256dh: subscription.P256DH,
			},
		},
		&webpush.Options{
			HTTPClient:      s.client,
			Subscriber:      s.cfg.Subject,
			TTL:             messageTTL,
			Urgency:         webpush.UrgencyHigh,
			VAPIDPublicKey:  s.cfg.PublicKey,
			VAPIDPrivateKey: s.cfg.PrivateKey,
		})
	if err != nil {
		return err
	}
	defer response.Body.Close()
	_, _ = io.Copy(io.Discard, response.Body)

	switch {
	case response.StatusCode >= 200 && response.StatusCode < 300:
		return nil
	case response.StatusCode == http.StatusNotFound || response.StatusCode == http.StatusGone:
		// The browser dropped the subscription: forget it and let the next
		// visit re-subscribe.
		if err := s.store.DeletePushSubscriptionByEndpoint(ctx, subscription.Endpoint); err != nil {
			s.logger.Warn("delete expired push subscription failed", "error", err)
		}
		return fmt.Errorf("subscription expired: %s", response.Status)
	default:
		return fmt.Errorf("push service returned %s", response.Status)
	}
}

func (s *Service) cleanup(ctx context.Context, now time.Time) {
	before := now.AddDate(0, 0, -retentionDays).Format(time.DateOnly)
	if err := s.store.DeleteOldReminderDeliveries(ctx, before); err != nil {
		s.logger.Warn("cleanup reminder deliveries failed", "error", err)
	}
}

func (s *Service) appURL() string {
	return strings.TrimRight(s.cfg.AppURL, "/") + "/"
}

// reminderDue reports whether now falls into the [time, time+dueWindow)
// interval of the given HH:MM reminder.
func reminderDue(reminderTime string, now time.Time) (time.Time, bool) {
	parsed, err := time.Parse("15:04", strings.TrimSpace(reminderTime))
	if err != nil {
		return time.Time{}, false
	}

	target := time.Date(now.Year(), now.Month(), now.Day(), parsed.Hour(), parsed.Minute(), 0, 0, now.Location())
	elapsed := now.Sub(target)
	return target, elapsed >= 0 && elapsed < dueWindow
}

func notificationBody(description, reminderTime string) string {
	text := strings.TrimSpace(description)
	if text == "" {
		text = "Напоминание в " + reminderTime
	}

	runes := []rune(text)
	if len(runes) > maxBodyRunes {
		return string(runes[:maxBodyRunes-1]) + "…"
	}
	return text
}
