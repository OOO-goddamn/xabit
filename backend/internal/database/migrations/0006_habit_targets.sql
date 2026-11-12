-- Quantity habits: an optional daily target with a unit and a quick-add step.
-- Habits without a target keep the previous binary done/skipped behaviour.
ALTER TABLE habits
    ADD COLUMN IF NOT EXISTS target_value INT,
    ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS step_value INT NOT NULL DEFAULT 1;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'habits_target_value_check'
    ) THEN
        ALTER TABLE habits ADD CONSTRAINT habits_target_value_check
            CHECK (target_value IS NULL OR target_value > 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'habits_step_value_check'
    ) THEN
        ALTER TABLE habits ADD CONSTRAINT habits_step_value_check
            CHECK (step_value > 0);
    END IF;
END $$;

-- The value is the amount done on that day. Binary habits keep 0.
ALTER TABLE habit_completions
    ADD COLUMN IF NOT EXISTS value INT NOT NULL DEFAULT 0;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'habit_completions_value_check'
    ) THEN
        ALTER TABLE habit_completions ADD CONSTRAINT habit_completions_value_check
            CHECK (value >= 0);
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'habit_completions_status_check'
    ) THEN
        ALTER TABLE habit_completions DROP CONSTRAINT habit_completions_status_check;
    END IF;

    ALTER TABLE habit_completions ADD CONSTRAINT habit_completions_status_check
        CHECK (status IN ('done', 'skipped', 'progress'));
END $$;
