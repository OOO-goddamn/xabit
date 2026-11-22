ALTER TABLE tasks
    ADD COLUMN priority TEXT NOT NULL DEFAULT 'normal'
        CHECK (priority IN ('low', 'normal', 'high'));
