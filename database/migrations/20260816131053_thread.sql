-- migrate:up

CREATE TABLE public.writing_thread
(
    id               UUID PRIMARY KEY     DEFAULT uuidv7(),
    writing_group_id UUID        NOT NULL REFERENCES public.writing_group (id) ON UPDATE CASCADE ON DELETE CASCADE,

    title            TEXT        NOT NULL,

    created_by       uuid        references public.user (id) on update cascade on delete set null,

    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at
    BEFORE UPDATE
    ON public.writing_thread
    FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

---

CREATE TABLE public.writing_post
(
    id                UUID PRIMARY KEY     DEFAULT uuidv7(),
    writing_thread_id UUID        NOT NULL REFERENCES public.writing_thread (id) ON UPDATE CASCADE ON DELETE CASCADE,

    text              TEXT        NOT NULL,
    is_draft          BOOLEAN     NOT NULL,

    created_by        uuid        references public.user (id) on update cascade on delete set null,

    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at
    BEFORE UPDATE
    ON public.writing_post
    FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

---

CREATE INDEX writing_thread_writing_group_id_idx ON public.writing_thread (writing_group_id);
CREATE INDEX writing_thread_created_by_idx ON public.writing_thread (created_by);
CREATE INDEX writing_post_writing_thread_id_idx ON public.writing_post (writing_thread_id);
CREATE INDEX writing_post_created_by_idx ON public.writing_post (created_by);

-- migrate:down

DROP TABLE public.writing_post;
DROP TABLE public.writing_thread;
