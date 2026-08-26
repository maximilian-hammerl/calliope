-- migrate:up

-- What a profile answers: not who somebody is, but whether they would suit you to write with.
-- Prose, unlike writing_group's columns of the same name — a story's metadata is filtered, a
-- profile is read about one person. No visibility column: nothing here is readable without an
-- account, so leaving a field empty is the only lever a member needs.
ALTER TABLE public.user
    -- An age or a form of address gets no column of its own: `about_me` holds it if somebody
    -- wants to say it, where a column would ask everyone.
    ADD COLUMN about_me                    TEXT,
    -- Preferences; a member reads „Bevorzugte Schreibweise", as on Yooco.
    ADD COLUMN writing_style                TEXT,
    ADD COLUMN post_length                  TEXT,
    ADD COLUMN writing_frequency            TEXT,
    -- Kept apart from one's own frequency, as Yooco keeps it.
    ADD COLUMN co_writer_expectations       TEXT,
    -- „NO-GOs beim Schreiben" to a member; the column says what it is.
    ADD COLUMN writing_boundaries           TEXT,
    -- Prose here, an array on writing_group: not the same thing.
    ADD COLUMN genres                       TEXT;

-- migrate:down

ALTER TABLE public.user
    DROP COLUMN about_me,
    DROP COLUMN writing_style,
    DROP COLUMN post_length,
    DROP COLUMN writing_frequency,
    DROP COLUMN co_writer_expectations,
    DROP COLUMN writing_boundaries,
    DROP COLUMN genres;
