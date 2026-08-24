-- migrate:up

-- What a member has read of somebody else's ideas. Named for the reader, not for a state, so it
-- stays true whatever it comes to hold. Distinct from story_idea.status, which is 'open' /
-- 'closed' and belongs to the author.
--
-- Never shown to the author: "four members read your idea" is the kind of statistic the
-- research rejected outright.
--
-- **A row means read, and there is no state column.** It held `('read', 'marked')` once, on the
-- argument that "marked implies read, so one column covers both" — but marking something to come
-- back to is not a fact about reading, and putting the two in one column meant a member could not
-- have both: setting one overwrote the other, and filtering for `read` hid everything marked.
-- Marking is now `favourite`, which covers all five kinds rather than this one, and what is left
-- here is a single fact with no value to carry.
--
-- 'ignored' was considered and deferred for this table, and would bring a column back with it.
-- With the board filtered to unread by default, read ideas are already out of view, so it would
-- only pay off inside a large read pile.
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
