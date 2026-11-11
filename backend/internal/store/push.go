package store

import (
	"context"
)

// PushSubscription is a browser push subscription owned by a user.
type PushSubscription struct {
	ID       int64
	UserID   int64
	Endpoint string
	P256DH   string
	Auth     string
	Timezone string
}

// PushReminder is a habit with a reminder joined with one of its owner's
// subscriptions. The scheduler turns it into a push notification.
type PushReminder struct {
	HabitID          int64
	HabitName        string
	HabitDescription string
	ReminderTime     string
	Subscription     PushSubscription
}

// SavePushSubscription creates a subscription or refreshes its keys and
// timezone. The endpoint is globally unique: re-subscribing from the same
// browser updates the existing row instead of creating duplicates.
func (s *Store) SavePushSubscription(ctx context.Context, userID int64, endpoint, p256dh, auth, timezone string) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, timezone)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (endpoint) DO UPDATE SET
			user_id = EXCLUDED.user_id,
			p256dh = EXCLUDED.p256dh,
			auth = EXCLUDED.auth,
			timezone = EXCLUDED.timezone,
			updated_at = now()`,
		userID, endpoint, p256dh, auth, timezone,
	)
	return err
}

func (s *Store) DeletePushSubscription(ctx context.Context, userID int64, endpoint string) error {
	_, err := s.pool.Exec(ctx,
		`DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2`,
		userID, endpoint,
	)
	return err
}

// DeletePushSubscriptionByEndpoint drops a subscription rejected by the push
// service (404/410): the browser will subscribe again on the next visit.
func (s *Store) DeletePushSubscriptionByEndpoint(ctx context.Context, endpoint string) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM push_subscriptions WHERE endpoint = $1`, endpoint)
	return err
}

func (s *Store) PushSubscriptionsByUser(ctx context.Context, userID int64) ([]PushSubscription, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, user_id, endpoint, p256dh, auth, timezone
		FROM push_subscriptions
		WHERE user_id = $1
		ORDER BY id`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	subscriptions := make([]PushSubscription, 0)
	for rows.Next() {
		subscription, err := scanPushSubscription(rows)
		if err != nil {
			return nil, err
		}
		subscriptions = append(subscriptions, subscription)
	}

	return subscriptions, rows.Err()
}

// PushReminderCandidates returns every habit with a reminder alongside every
// subscription of its owner. The scheduler filters by each subscription's
// local time and by existing completions.
func (s *Store) PushReminderCandidates(ctx context.Context) ([]PushReminder, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT h.id, h.name, h.description,
		       to_char(h.reminder_time, 'HH24:MI'),
		       s.id, s.user_id, s.endpoint, s.p256dh, s.auth, s.timezone
		FROM habits h
		JOIN push_subscriptions s ON s.user_id = h.user_id
		WHERE h.reminder_time IS NOT NULL
		ORDER BY h.id, s.id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	reminders := make([]PushReminder, 0)
	for rows.Next() {
		var reminder PushReminder
		var subscription PushSubscription

		err := rows.Scan(
			&reminder.HabitID,
			&reminder.HabitName,
			&reminder.HabitDescription,
			&reminder.ReminderTime,
			&subscription.ID,
			&subscription.UserID,
			&subscription.Endpoint,
			&subscription.P256DH,
			&subscription.Auth,
			&subscription.Timezone,
		)
		if err != nil {
			return nil, err
		}

		reminder.Subscription = subscription
		reminders = append(reminders, reminder)
	}

	return reminders, rows.Err()
}

// CompletionExists reports whether the habit already has any mark (done or
// skipped) on the given day. Such habits must not trigger a reminder.
func (s *Store) CompletionExists(ctx context.Context, habitID int64, date string) (bool, error) {
	var exists bool
	err := s.pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM habit_completions
			WHERE habit_id = $1 AND date = $2::date
		)`, habitID, date).Scan(&exists)
	return exists, err
}

// ClaimReminderDelivery atomically reserves a (device, habit, day) delivery.
// It returns false when the push was already sent, so a scheduler restart or
// several ticks inside the same due window cannot duplicate notifications.
func (s *Store) ClaimReminderDelivery(ctx context.Context, subscriptionID, habitID int64, date string) (bool, error) {
	tag, err := s.pool.Exec(ctx, `
		INSERT INTO reminder_deliveries (subscription_id, habit_id, date)
		VALUES ($1, $2, $3::date)
		ON CONFLICT (subscription_id, habit_id, date) DO NOTHING`,
		subscriptionID, habitID, date,
	)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

// ReleaseReminderDelivery removes a claim after a failed push so the next tick
// inside the due window can retry it.
func (s *Store) ReleaseReminderDelivery(ctx context.Context, subscriptionID, habitID int64, date string) error {
	_, err := s.pool.Exec(ctx, `
		DELETE FROM reminder_deliveries
		WHERE subscription_id = $1 AND habit_id = $2 AND date = $3::date`,
		subscriptionID, habitID, date,
	)
	return err
}

// DeleteOldReminderDeliveries keeps the delivery log small.
func (s *Store) DeleteOldReminderDeliveries(ctx context.Context, before string) error {
	_, err := s.pool.Exec(ctx,
		`DELETE FROM reminder_deliveries WHERE date < $1::date`, before)
	return err
}

func scanPushSubscription(row habitRow) (PushSubscription, error) {
	var subscription PushSubscription
	err := row.Scan(
		&subscription.ID,
		&subscription.UserID,
		&subscription.Endpoint,
		&subscription.P256DH,
		&subscription.Auth,
		&subscription.Timezone,
	)
	return subscription, err
}
