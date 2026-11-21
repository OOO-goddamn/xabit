CREATE TABLE IF NOT EXISTS tasks (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title        TEXT NOT NULL CHECK (btrim(title) <> ''),
    note         TEXT NOT NULL DEFAULT '',
    due_date     DATE,
    done         BOOLEAN NOT NULL DEFAULT false,
    sort_order   INT NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS tasks_user_due_idx
    ON tasks (user_id, due_date, sort_order, id);
CREATE INDEX IF NOT EXISTS tasks_user_done_idx
    ON tasks (user_id, done, sort_order, id);
