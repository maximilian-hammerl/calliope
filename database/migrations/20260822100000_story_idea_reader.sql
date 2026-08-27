-- migrate:up

-- What a member has read of somebody else's ideas. Named for the reader, not for a state, so it
-- stays true whatever it comes to hold. Never shown to the author: "four members read your idea"
-- is the statistic the research rejected.
--
-- A row means read; there is no state column. It held `('read', 'marked')` once, which meant a
-- member could not have both — marking is now `favourite`, across all five kinds.
CREATE TABLE public.story_idea_reader
(
    story_idea_id UUID        NOT NULL REFERENCES public.story_idea (id) ON UPDATE CASCADE ON DELETE CASCADE,
    user_id       UUID        NOT NULL REFERENCES public.user (id) ON UPDATE CASCADE ON DELETE CASCADE,

    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (story_idea_id, user_id)
);

-- The board reads this per member, and unread is the absence of a row rather than a value, so
-- the member's id is the whole of what it looks up by.
CREATE INDEX story_idea_reader_user_idx ON public.story_idea_reader (user_id);

-- migrate:down

DROP TABLE public.story_idea_reader;
