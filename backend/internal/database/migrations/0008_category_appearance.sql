ALTER TABLE categories
    ADD COLUMN icon TEXT NOT NULL DEFAULT 'tag'
        CHECK (icon IN ('tag', 'heart', 'activity', 'book', 'briefcase', 'dumbbell', 'apple', 'brain', 'home', 'wallet', 'sparkles', 'sun', 'leaf', 'education', 'target', 'coffee')),
    ADD COLUMN color TEXT NOT NULL DEFAULT '#1d5c48'
        CHECK (color ~ '^#[0-9A-Fa-f]{6}$');

-- Preserve the color scheme users already saw before appearance became editable.
UPDATE categories
SET color = CASE mod(id, 5)
    WHEN 1 THEN '#bf6a44'
    WHEN 2 THEN '#c49a4a'
    WHEN 3 THEN '#6c7f9e'
    WHEN 4 THEN '#a06b8a'
    ELSE '#1d5c48'
END;
