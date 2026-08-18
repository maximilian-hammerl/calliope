-- migrate:up

CREATE TABLE public.thread
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
    ON public.thread
    FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.post
(
    id         UUID PRIMARY KEY     DEFAULT uuidv7(),
    thread_id  UUID        NOT NULL REFERENCES public.thread (id) ON UPDATE CASCADE ON DELETE CASCADE,

    text       TEXT        NOT NULL,
    is_draft   BOOLEAN     NOT NULL,

    created_by uuid        references public.user (id) on update cascade on delete set null,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at
    BEFORE UPDATE
    ON public.post
    FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX thread_writing_group_id_idx ON public.thread (writing_group_id);
CREATE INDEX thread_created_by_idx ON public.thread (created_by);
CREATE INDEX post_thread_id_idx ON public.post (thread_id);
CREATE INDEX post_created_by_idx ON public.post (created_by);

-- migrate:down

DROP TABLE public.post;
DROP TABLE public.thread;
