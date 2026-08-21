-- migrate:up

-- 'ignored' was considered and deferred: with the board filtered to unread by default, read
-- ideas are already out of view, so it would only pay off inside a large read pile.
CREATE TYPE public.story_idea_reader_state AS ENUM ('read', 'marked');

-- What a member has done with somebody else's idea. Named for the reader, not for one of the
-- states, so it stays true whatever the enum holds. Distinct from story_idea.status, which is
-- 'open' / 'closed' and belongs to the author.
--
-- Never shown to the author: "four members read your idea" is the kind of statistic the
-- research rejected outright.
CREATE TABLE public.story_idea_reader
(
    story_idea_id UUID                          NOT NULL REFERENCES public.story_idea (id) ON UPDATE CASCADE ON DELETE CASCADE,
    user_id       UUID                          NOT NULL REFERENCES public.user (id) ON UPDATE CASCADE ON DELETE CASCADE,

    -- 'marked' implies read, so one column covers both. Absent means unread.
    state         public.story_idea_reader_state NOT NULL,

    created_at    TIMESTAMPTZ                   NOT NULL DEFAULT now(),

    PRIMARY KEY (story_idea_id, user_id)
);

-- The board reads this per member, filtered by state.
CREATE INDEX story_idea_reader_user_idx ON public.story_idea_reader (user_id, state);

-- migrate:down

DROP TABLE public.story_idea_reader;

DROP TYPE public.story_idea_reader_state;
