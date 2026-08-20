-- migrate:up

-- §8.3 lists more states ('discussing', 'partners_found', 'archived'), all left out: an idea is
-- answerable or it is not, and a state members must remember to set would mostly sit wrong.
CREATE TYPE public.story_idea_status AS ENUM ('open', 'closed');

CREATE TYPE public.story_idea_party_size AS ENUM ('one_on_one', 'group');

-- §8's partner request, reframed as what members actually valued about it: an idea seeking
-- writers ("Gesuche mit schon einer konkreten Idee"). The story block mirrors writing_group
-- column for column, so founding a group from an idea is one day a copy rather than a mapping.
-- The seeking block describes the search and dies with it.
CREATE TABLE public.story_idea
(
    id               UUID PRIMARY KEY                   DEFAULT uuidv7(),

    title            TEXT                      NOT NULL,
    subtitle         TEXT,
    -- The idea itself; becomes the group's blurb.
    idea             TEXT                      NOT NULL,

    genres           TEXT[]                    NOT NULL DEFAULT '{}',
    subgenres        TEXT[]                    NOT NULL DEFAULT '{}',
    tropes           TEXT[]                    NOT NULL DEFAULT '{}',
    content_warnings TEXT[]                    NOT NULL DEFAULT '{}',
    tense            TEXT,
    perspective      TEXT,
    language         public.story_language     NOT NULL DEFAULT 'german',

    -- The seeking block. Free text where members write, an enum where §8.2 filters.
    looking_for      TEXT,
    party_size       public.story_idea_party_size,

    status           public.story_idea_status  NOT NULL DEFAULT 'open',

    -- CASCADE, unlike a post's SET NULL: an idea is a personal ad, nobody else's story yet.
    created_by       UUID                      NOT NULL REFERENCES public.user (id) ON UPDATE CASCADE ON DELETE CASCADE,
    created_at       TIMESTAMPTZ               NOT NULL DEFAULT now()
);

-- The board lists newest first and filters by status; one index serves both.
CREATE INDEX story_idea_status_created_at_idx ON public.story_idea (status, created_at DESC);
CREATE INDEX story_idea_created_by_idx ON public.story_idea (created_by);

-- migrate:down

DROP TABLE public.story_idea;
DROP TYPE public.story_idea_status;
DROP TYPE public.story_idea_party_size;
