CREATE TABLE IF NOT EXISTS categories (
    id         BIGSERIAL PRIMARY KEY,
    name       TEXT NOT NULL UNIQUE CHECK (btrim(name) <> '')
);

CREATE TABLE IF NOT EXISTS habits (
    id          BIGSERIAL PRIMARY KEY,
    name        TEXT NOT NULL CHECK (btrim(name) <> ''),
    description TEXT NOT NULL DEFAULT '',
    category_id BIGINT NOT NULL REFERENCES categories (id) ON DELETE RESTRICT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS habits_category_id_idx ON habits (category_id);

CREATE TABLE IF NOT EXISTS habit_completions (
    id         BIGSERIAL PRIMARY KEY,
    habit_id   BIGINT NOT NULL REFERENCES habits (id) ON DELETE CASCADE,
    date       DATE NOT NULL,
    status     TEXT NOT NULL CHECK (status IN ('done', 'skipped')),
    note       TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT habit_completions_habit_date_unique UNIQUE (habit_id, date)
);

CREATE INDEX IF NOT EXISTS habit_completions_date_idx ON habit_completions (date);
CREATE INDEX IF NOT EXISTS habit_completions_habit_id_idx ON habit_completions (habit_id);
