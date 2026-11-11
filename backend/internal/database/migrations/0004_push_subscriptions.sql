-- Web Push subscriptions created by the browser (service worker + VAPID).
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    endpoint   TEXT NOT NULL UNIQUE,
    p256dh     TEXT NOT NULL,
    auth       TEXT NOT NULL,
    timezone   TEXT NOT NULL DEFAULT 'UTC',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx ON push_subscriptions (user_id);

-- One row per habit, device and local day: guarantees a single push per day
-- even when the scheduler runs every 30 seconds or restarts.
CREATE TABLE IF NOT EXISTS reminder_deliveries (
    subscription_id BIGINT NOT NULL REFERENCES push_subscriptions (id) ON DELETE CASCADE,
    habit_id        BIGINT NOT NULL REFERENCES habits (id) ON DELETE CASCADE,
    date            DATE NOT NULL,
    sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT reminder_deliveries_pkey PRIMARY KEY (subscription_id, habit_id, date)
);

CREATE INDEX IF NOT EXISTS reminder_deliveries_date_idx ON reminder_deliveries (date);
