-- migrate:up

-- One member marking one thing. No `target_type` column, unlike `report` and `notification`:
-- these references CASCADE, so exactly one stays non-null for the row's life and the kind is
-- readable off the data. A sixth kind is then a column and nothing else.
--
-- No `updated_at`: a favourite exists or it does not.
CREATE TABLE public.favourite
(
    id                UUID PRIMARY KEY                DEFAULT uuidv7(),

    user_id           UUID                   NOT NULL REFERENCES public.user (id) ON UPDATE CASCADE ON DELETE CASCADE,

    -- Exactly one of these is set, and stays set: the row goes with whatever it names.
    writing_group_id  UUID                            REFERENCES public.writing_group (id) ON UPDATE CASCADE ON DELETE CASCADE,
    writing_thread_id UUID                            REFERENCES public.writing_thread (id) ON UPDATE CASCADE ON DELETE CASCADE,
    writing_post_id   UUID                            REFERENCES public.writing_post (id) ON UPDATE CASCADE ON DELETE CASCADE,
    writing_page_id   UUID                            REFERENCES public.writing_page (id) ON UPDATE CASCADE ON DELETE CASCADE,
    story_idea_id     UUID                            REFERENCES public.story_idea (id) ON UPDATE CASCADE ON DELETE CASCADE,
    chat_group_id     UUID                            REFERENCES public.chat_group (id) ON UPDATE CASCADE ON DELETE CASCADE,

    created_at        TIMESTAMPTZ            NOT NULL DEFAULT now(),

    CONSTRAINT favourite_names_exactly_one_thing CHECK (
        num_nonnulls(writing_group_id, writing_thread_id, writing_post_id, writing_page_id,
                     story_idea_id, chat_group_id) = 1
        )
);

-- One favourite per member per thing. NULLS NOT DISTINCT because five of the six references are
-- always NULL and Postgres would otherwise treat every row as unique — the same reason `report`'s
-- index needs it. Unlike that one it needs no predicate: a favourite has no status to be in, and
-- no reference that can empty under it.
--
-- It is also what every list looks a favourite up through, since `user_id` leads it: each list
-- joins on its own column and the member's id. Leading with `user_id` is what makes it useless for
-- the cascade, which is why the per-kind indexes below exist.
CREATE UNIQUE INDEX favourite_one_per_member_idx
    ON public.favourite (user_id, writing_group_id, writing_thread_id, writing_post_id,
                         writing_page_id, story_idea_id, chat_group_id)
    NULLS NOT DISTINCT;

-- Per kind, because the cascade needs one and the index above cannot serve it: it leads with
-- `user_id`. Partial, so each holds only its own kind.
CREATE INDEX favourite_writing_group_idx ON public.favourite (writing_group_id)
    WHERE writing_group_id IS NOT NULL;

CREATE INDEX favourite_writing_thread_idx ON public.favourite (writing_thread_id)
    WHERE writing_thread_id IS NOT NULL;

CREATE INDEX favourite_writing_post_idx ON public.favourite (writing_post_id)
    WHERE writing_post_id IS NOT NULL;

CREATE INDEX favourite_writing_page_idx ON public.favourite (writing_page_id)
    WHERE writing_page_id IS NOT NULL;

CREATE INDEX favourite_story_idea_idx ON public.favourite (story_idea_id)
    WHERE story_idea_id IS NOT NULL;

CREATE INDEX favourite_chat_group_idx ON public.favourite (chat_group_id)
    WHERE chat_group_id IS NOT NULL;

-- migrate:down

-- The indexes go with the table.
DROP TABLE public.favourite;
