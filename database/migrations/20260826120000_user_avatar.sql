-- migrate:up

-- English like every other enum here; the German a member reads lives in the frontend, because a
-- word stored in one language can only be shown in that one.
CREATE TYPE public.avatar_origin AS ENUM (
    'own_work',
    'licence',
    'permission',
    'public_domain',
    'other'
    );

-- One picture per member, keyed by member so that is a constraint rather than a habit — and the
-- key's own index is the one the cascade needs. The bytes live on the filesystem; see #94.
CREATE TABLE public.user_avatar
(
    user_id    UUID PRIMARY KEY     REFERENCES public.user (id) ON UPDATE CASCADE ON DELETE CASCADE,

    -- The file's name on disk and the last segment of its URL, new on every upload so the URL can
    -- be cached immutably. A uuid rather than a hash of the bytes: the type is also the path check.
    file_id    UUID        NOT NULL DEFAULT uuidv7(),

    origin     public.avatar_origin NOT NULL,

    -- Quelle, Urheber and Lizenz in one line. Bounded in `text_limit.ts` like every other prose.
    credit     TEXT,

    -- Setting the picture and confirming the declaration are one submission, so one timestamp.
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Nothing to credit for your own picture; anything else has to say where it came from.
    CONSTRAINT user_avatar_credits_what_is_not_its_own CHECK (
        origin = 'own_work' OR credit IS NOT NULL
        )
);

-- What the sweep asks: which files are still referenced. Unique, because a file belongs to one
-- avatar.
CREATE UNIQUE INDEX user_avatar_file_idx ON public.user_avatar (file_id);

-- migrate:down

DROP TABLE public.user_avatar;

DROP TYPE public.avatar_origin;
