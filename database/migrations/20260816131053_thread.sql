-- migrate:up

CREATE TABLE public.writing_thread
(
    id               UUID PRIMARY KEY     DEFAULT uuidv7(),
    writing_group_id UUID        NOT NULL REFERENCES public.writing_group (id) ON UPDATE CASCADE ON DELETE CASCADE,

    title            TEXT        NOT NULL,

    created_by       uuid        references public.user (id) on update cascade on delete set null,

    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

---

CREATE TABLE public.writing_post
(
    id                UUID PRIMARY KEY     DEFAULT uuidv7(),
    writing_thread_id UUID        NOT NULL REFERENCES public.writing_thread (id) ON UPDATE CASCADE ON DELETE CASCADE,

    -- The post as written: a ProseMirror document, validated against the whitelist in the
    -- backend's document.ts before it is ever stored.
    document          JSONB       NOT NULL,

    -- The same prose with the markup taken out, derived on write. Search runs against this
    -- rather than the document, so looking for "stark" finds the word and not a bold mark,
    -- and the length limit counts characters somebody actually typed.
    text              TEXT        NOT NULL,

    is_draft          BOOLEAN     NOT NULL,

    created_by        uuid        references public.user (id) on update cascade on delete set null,

    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Null until the post is changed after it was published, which is the only edit a reader
    -- is told about ("· bearbeitet"). Writing a draft is not an edit, and neither is
    -- publishing one. Stated outright rather than inferred from two timestamps disagreeing,
    -- which could not tell those three apart.
    edited_at         TIMESTAMPTZ
);

---

CREATE INDEX writing_thread_writing_group_id_idx ON public.writing_thread (writing_group_id);
CREATE INDEX writing_thread_created_by_idx ON public.writing_thread (created_by);
CREATE INDEX writing_post_writing_thread_id_idx ON public.writing_post (writing_thread_id);
CREATE INDEX writing_post_created_by_idx ON public.writing_post (created_by);

-- The composer holds exactly one draft per thread, so two tabs cannot quietly leave a second
-- one behind. Authors are compared as ids: a draft whose author was deleted has created_by
-- NULL, and NULLs are distinct here, which is right — such a row is unreachable anyway.
CREATE UNIQUE INDEX writing_post_one_draft_per_author
    ON public.writing_post (writing_thread_id, created_by)
    WHERE is_draft;

-- migrate:down

DROP TABLE public.writing_post;
DROP TABLE public.writing_thread;
