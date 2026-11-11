-- Per-habit repetition schedule. 'daily' keeps the previous behaviour.
-- weekdays stores ISO weekday numbers (1 = Monday ... 7 = Sunday) for
-- 'weekly'; month_day stores the day of month for 'monthly'.
ALTER TABLE habits
    ADD COLUMN IF NOT EXISTS repeat_type TEXT NOT NULL DEFAULT 'daily',
    ADD COLUMN IF NOT EXISTS weekdays INT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS month_day SMALLINT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'habits_repeat_type_check'
    ) THEN
        ALTER TABLE habits ADD CONSTRAINT habits_repeat_type_check
            CHECK (repeat_type IN ('daily', 'weekly', 'monthly'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'habits_month_day_check'
    ) THEN
        ALTER TABLE habits ADD CONSTRAINT habits_month_day_check
            CHECK (month_day IS NULL OR (month_day BETWEEN 1 AND 31));
    END IF;
END $$;
