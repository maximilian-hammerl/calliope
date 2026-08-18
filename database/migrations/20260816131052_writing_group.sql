-- migrate:up

CREATE TYPE public.writing_group_visibility AS ENUM ('public', 'private');

CREATE TABLE public.writing_group
(
    id          UUID PRIMARY KEY                         DEFAULT uuidv7(),
    title       TEXT                            NOT NULL,
    description TEXT                            NOT NULL,
    visibility  public.writing_group_visibility NOT NULL DEFAULT 'private',
    created_by  uuid                            references public.user (id) on update cascade on delete set null,
    created_at  TIMESTAMPTZ                     NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ                     NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at
    BEFORE UPDATE
    ON public.writing_group
    FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

---

CREATE TYPE public.user_in_writing_group_role AS ENUM ('administrator', 'writer', 'reader');

CREATE TYPE public.user_in_writing_group_status AS ENUM ('invited', 'joined');

CREATE TABLE public.user_in_writing_group
(
    user_id          UUID                                NOT NULL REFERENCES public.user (id) ON UPDATE CASCADE ON DELETE CASCADE,
    writing_group_id UUID                                NOT NULL REFERENCES public.writing_group (id) ON UPDATE CASCADE ON DELETE CASCADE,
    PRIMARY KEY (user_id, writing_group_id),
    role             public.user_in_writing_group_role   not null,
    status           public.user_in_writing_group_status not null,
    created_at       TIMESTAMPTZ                         NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ                         NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at
    BEFORE UPDATE
    ON public.user_in_writing_group
    FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX writing_group_created_by_idx ON public.writing_group (created_by);
-- The primary key leads with user_id, so listing a group's members cannot use it.
CREATE INDEX user_in_writing_group_writing_group_id_idx
    ON public.user_in_writing_group (writing_group_id);

-- migrate:down

DROP TABLE public.user_in_writing_group;
DROP TABLE public.writing_group;

DROP TYPE public.user_in_writing_group_status;
DROP TYPE public.user_in_writing_group_role;
DROP TYPE public.writing_group_visibility;
