ALTER TABLE habits
    ADD COLUMN IF NOT EXISTS reminder_time TIME;

COMMENT ON COLUMN habits.reminder_time IS 'Local time of day for the habit reminder; NULL means no reminder.';
