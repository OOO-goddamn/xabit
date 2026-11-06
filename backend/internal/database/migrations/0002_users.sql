CREATE TABLE IF NOT EXISTS users (
    id            BIGSERIAL PRIMARY KEY,
    email         TEXT NOT NULL CHECK (btrim(email) <> ''),
    name          TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email));

CREATE TABLE IF NOT EXISTS sessions (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at);

ALTER TABLE categories
    ADD COLUMN IF NOT EXISTS user_id BIGINT REFERENCES users (id) ON DELETE CASCADE;

ALTER TABLE habits
    ADD COLUMN IF NOT EXISTS user_id BIGINT REFERENCES users (id) ON DELETE CASCADE;

-- Existing installations stored a single user's data. Attach it to a demo
-- account so nothing disappears after upgrading. Password: habit12345.
INSERT INTO users (email, name, password_hash)
SELECT 'demo@habit.local', 'Демо-пользователь',
       'pbkdf2_sha256$210000$BHE13OapYZ_faq77-Kzysg$e4YCqUxefqHxwVJTfyYGShUPpx2by96cxK9PMLjf5So'
WHERE NOT EXISTS (
    SELECT 1 FROM users WHERE lower(email) = 'demo@habit.local'
);

UPDATE categories
SET user_id = (SELECT id FROM users WHERE lower(email) = 'demo@habit.local')
WHERE user_id IS NULL;

UPDATE habits
SET user_id = (SELECT id FROM users WHERE lower(email) = 'demo@habit.local')
WHERE user_id IS NULL;

ALTER TABLE categories ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE habits ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS categories_user_name_idx
    ON categories (user_id, lower(name));

CREATE INDEX IF NOT EXISTS categories_user_id_idx ON categories (user_id);
CREATE INDEX IF NOT EXISTS habits_user_id_idx ON habits (user_id);
