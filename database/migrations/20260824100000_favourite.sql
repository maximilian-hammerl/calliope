-- migrate:up

-- One member marking one thing, in the polymorphic shape `report` and `notification` both use:
-- one nullable reference per kind and a CHECK holding them together.
--
-- **It carries no target-type column, and the reason is worth knowing**, because the two tables it
-- resembles both do.
--
-- `report`'s references are ON DELETE SET NULL, because a report is evidence and must outlive
-- what it names — so once the target is deleted the columns say nothing, and only
-- `target_type` still records what kind of thing it was. `notification.type` is not a target
-- discriminant at all: four of its seven values set `writing_group_id` and nothing else, so the
-- type carries what the columns cannot.
--
-- Here neither holds. These references CASCADE, so exactly one is non-null for the whole life of
-- the row, and each column has exactly one meaning — the kind is always readable off the data. A
-- column repeating it could only ever disagree with it.
--
-- What follows is that the CHECK gets to be the whole rule in one line rather than a CASE per
-- kind, and that a sixth kind is a column and nothing else: no enum value, no new branch, and
-- `num_nonnulls` covers it the moment it exists.
--
-- No `updated_at`: nothing about a favourite changes. It exists or it does not, and `created_at`
-- is what orders one member's favourites among themselves if anything ever wants to.
CREATE TABLE public.favourite
(
    id                UUID PRIMARY KEY                DEFAULT uuidv7(),

    user_id           UUID                   NOT NULL REFERENCES public.user (id) ON UPDATE CASCADE ON DELETE CASCADE,

    -- Exactly one of these is set, and stays set: the row goes with whatever it names.
    writing_group_id  UUID                            REFERENCES public.writing_group (id) ON UPDATE CASCADE ON DELETE CASCADE,
    writing_thread_id UUID                            REFERENCES public.writing_thread (id) ON UPDATE CASCADE ON DELETE CASCADE,
    writing_post_id   UUID                            REFERENCES public.writing_post (id) ON UPDATE CASCADE ON DELETE CASCADE,
    story_idea_id     UUID                            REFERENCES public.story_idea (id) ON UPDATE CASCADE ON DELETE CASCADE,
    chat_group_id     UUID                            REFERENCES public.chat_group (id) ON UPDATE CASCADE ON DELETE CASCADE,

    created_at        TIMESTAMPTZ            NOT NULL DEFAULT now(),

    CONSTRAINT favourite_names_exactly_one_thing CHECK (
        num_nonnulls(writing_group_id, writing_thread_id, writing_post_id, story_idea_id,
                     chat_group_id) = 1
        )
);

-- One favourite per member per thing. NULLS NOT DISTINCT because four of the five references are
-- always NULL and Postgres would otherwise treat every row as unique — the same reason `report`'s
-- index needs it. Unlike that one it needs no predicate: a favourite has no status to be in, and
-- no reference that can empty under it.
--
-- It is also what every list looks a favourite up through, since `user_id` leads it: each list
-- joins on its own column and the member's id. Leading with `user_id` is what makes it useless for
-- the cascade, which is why the per-kind indexes below exist.
CREATE UNIQUE INDEX favourite_one_per_member_idx
    ON public.favourite (user_id, writing_group_id, writing_thread_id, writing_post_id,
                         story_idea_id, chat_group_id)
    NULLS NOT DISTINCT;

-- One index per kind, so a cascade can find the favourites pointing at what is being deleted.
-- Postgres indexes the *referenced* side of a foreign key and nothing on the referencing side, so
-- without these `ON DELETE CASCADE` scans this whole table once per row deleted: a thread of a
-- hundred posts meant a hundred scans. The index above cannot serve it either, because it leads
-- with `user_id` and a lookup by target is not a prefix of that.
--
-- **Partial, because each row names exactly one thing.** A plain index would carry every row with
-- four fifths of its entries NULL, five times over. `WHERE ... IS NOT NULL` keeps each to the rows
-- of its own kind, and an equality lookup still uses it, since `col = $1` implies `col IS NOT
-- NULL`. See `database/AGENTS.md` for how to measure this without fooling yourself.
CREATE INDEX favourite_writing_group_idx ON public.favourite (writing_group_id)
    WHERE writing_group_id IS NOT NULL;

CREATE INDEX favourite_writing_thread_idx ON public.favourite (writing_thread_id)
    WHERE writing_thread_id IS NOT NULL;

CREATE INDEX favourite_writing_post_idx ON public.favourite (writing_post_id)
    WHERE writing_post_id IS NOT NULL;

CREATE INDEX favourite_story_idea_idx ON public.favourite (story_idea_id)
    WHERE story_idea_id IS NOT NULL;

CREATE INDEX favourite_chat_group_idx ON public.favourite (chat_group_id)
    WHERE chat_group_id IS NOT NULL;

-- migrate:down

-- The indexes go with the table.
DROP TABLE public.favourite;
