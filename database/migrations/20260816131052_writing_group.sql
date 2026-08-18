-- migrate:up

CREATE TYPE public.writing_group_visibility AS ENUM ('public', 'private');

CREATE TABLE public.writing_group
(
    id          UUID PRIMARY KEY                         DEFAULT uuidv7(),
    title       TEXT                            NOT NULL,
    description TEXT                            NOT NULL,
    visibility  public.writing_group_visibility NOT NULL DEFAULT 'private',
    created_by  uuid                            references public.user (id) on update cascade on delete set null,
    created_at  TIMESTAMPTZ                     NOT NULL DEFAULT now()
);

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
    created_at       TIMESTAMPTZ                         NOT NULL DEFAULT now()
);

---

CREATE FUNCTION public.delete_writing_group_after_last_user_leaves()
    RETURNS TRIGGER
    set search_path to ''
AS
$$
BEGIN
    -- Two members leaving at once would otherwise each still see the other's row, so neither
    -- deletes and the group is left with nobody in it. Taking the groups' row locks first
    -- serialises them; the DELETE below is a separate statement and so re-reads, seeing the
    -- other transaction's committed departure rather than this one's original snapshot.
    PERFORM 1
    FROM public.writing_group
    WHERE id = OLD.writing_group_id
        FOR UPDATE;

    DELETE
    FROM public.writing_group AS wg
    WHERE wg.id = OLD.writing_group_id
      AND NOT EXISTS (SELECT true FROM public.user_in_writing_group AS uiwg WHERE uiwg.writing_group_id = wg.id);

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER delete_writing_group_after_last_user_leaves
    AFTER DELETE
    ON public.user_in_writing_group
    FOR EACH ROW
EXECUTE FUNCTION public.delete_writing_group_after_last_user_leaves();

---

CREATE INDEX writing_group_created_by_idx ON public.writing_group (created_by);
-- The primary key leads with user_id, so listing a group's members cannot use it.
CREATE INDEX user_in_writing_group_writing_group_id_idx
    ON public.user_in_writing_group (writing_group_id);

-- migrate:down

DROP TABLE public.user_in_writing_group;
DROP TABLE public.writing_group;

DROP FUNCTION public.delete_writing_group_after_last_user_leaves();

DROP TYPE public.user_in_writing_group_status;
DROP TYPE public.user_in_writing_group_role;
DROP TYPE public.writing_group_visibility;
