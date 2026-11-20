ALTER TABLE categories
    ADD COLUMN sort_order INT NOT NULL DEFAULT 0;

ALTER TABLE habits
    ADD COLUMN sort_order INT NOT NULL DEFAULT 0;

WITH ranked AS (
    SELECT id, (ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY lower(name), id) - 1)::int AS position
    FROM categories
)
UPDATE categories c
SET sort_order = ranked.position
FROM ranked
WHERE c.id = ranked.id;

WITH ranked AS (
    SELECT id, (ROW_NUMBER() OVER (PARTITION BY user_id, category_id ORDER BY lower(name), id) - 1)::int AS position
    FROM habits
)
UPDATE habits h
SET sort_order = ranked.position
FROM ranked
WHERE h.id = ranked.id;

CREATE INDEX IF NOT EXISTS categories_user_sort_order_idx
    ON categories (user_id, sort_order, id);
CREATE INDEX IF NOT EXISTS habits_user_category_sort_order_idx
    ON habits (user_id, category_id, sort_order, id);
