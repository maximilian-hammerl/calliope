-- migrate:up

CREATE TYPE public.writing_group_visibility AS ENUM ('public', 'private');

-- Shared by writing_group and story_idea, so an idea's language survives becoming a group.
-- An enum, not text: a filter over free text is no filter. Two values until somebody needs a
-- third; members select rather than type, so nothing can be misspelt.
CREATE TYPE public.story_language AS ENUM ('german', 'english');

-- §7.4 also lists 'archived', left out until there is something to distinguish it from
-- 'finished': §22's archive is a *group* lifecycle — hidden, read-only, restorable — and none
-- of that is built, so the value would carry no behaviour.
CREATE TYPE public.writing_group_story_status AS ENUM ('planning', 'writing', 'finished');

-- A group holds one story for now. §5.1 has a group *containing* optional stories, and §43
-- puts that split in phase 2; until then the story's metadata lives on the group, and moving
-- it later is a migration rather than a redesign.
CREATE TABLE public.writing_group
(
    id               UUID PRIMARY KEY                         DEFAULT uuidv7(),
    title            TEXT                            NOT NULL,
    subtitle         TEXT,

    -- What the back cover says, at length. One word for it here and on story_idea, because an
    -- idea and the group it becomes carry the same text and two names would need a mapping.
    synopsis         TEXT                            NOT NULL,

    visibility       public.writing_group_visibility NOT NULL DEFAULT 'private',

    -- Story metadata. Every field optional: members told us Yooco's mandatory profile section
    -- got filled with nonsense purely to get past it, and a metadata block nobody means is
    -- worse than an empty one. Arrays are NOT NULL DEFAULT '{}', so "nothing given" has a
    -- single representation and reads never have to handle null.
    -- Named story_status, not status: the reader's own membership status is already called
    -- that everywhere a group is read. Not null, unlike the rest of the metadata — every
    -- story is at some point in its life, and 'planning' is where a new one starts.
    story_status     public.writing_group_story_status NOT NULL DEFAULT 'planning',
    genres           TEXT[]                          NOT NULL DEFAULT '{}',
    subgenres        TEXT[]                          NOT NULL DEFAULT '{}',
    tropes           TEXT[]                          NOT NULL DEFAULT '{}',
    content_warnings TEXT[]                          NOT NULL DEFAULT '{}',

    -- Free text, not enums: collaborative fiction mixes tense and person across chapters and
    -- characters more than any fixed list would survive.
    tense            TEXT,
    perspective      TEXT,

    language         public.story_language           NOT NULL DEFAULT 'german',

    created_by       uuid                            references public.user (id) on update cascade on delete set null,
    created_at       TIMESTAMPTZ                     NOT NULL DEFAULT now()
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

    invited_at       TIMESTAMPTZ,
    joined_at        TIMESTAMPTZ,

    -- Who did the inviting. Null for the founder of a group, who was invited by nobody, and
    -- null again once that account is gone — the membership outlives whoever opened the door.
    invited_by       UUID                                REFERENCES public.user (id) ON UPDATE CASCADE ON DELETE SET NULL,

    created_at       TIMESTAMPTZ                         NOT NULL DEFAULT now()
);

---

CREATE FUNCTION public.set_invited_joined_at_for_user_in_writing_group()
    RETURNS TRIGGER
    set search_path to ''
AS
$$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        NEW.invited_at = now();

        IF NEW.status = 'joined' THEN
            NEW.joined_at = now();
        END IF;

    ELSIF NEW.status = 'joined' AND OLD.status IS DISTINCT FROM 'joined' THEN
        NEW.joined_at = now();

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_invited_joined_at_for_user_in_writing_group
    BEFORE INSERT OR UPDATE
    ON public.user_in_writing_group
    FOR EACH ROW
EXECUTE FUNCTION public.set_invited_joined_at_for_user_in_writing_group();

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
-- Partial: most memberships are joined rather than invited.
CREATE INDEX user_in_writing_group_invited_by_idx
    ON public.user_in_writing_group (invited_by) WHERE invited_by IS NOT NULL;
-- The primary key leads with user_id, so listing a group's members cannot use it.
CREATE INDEX user_in_writing_group_writing_group_id_idx
    ON public.user_in_writing_group (writing_group_id);

-- migrate:down

DROP TABLE public.user_in_writing_group;
DROP FUNCTION public.set_invited_joined_at_for_user_in_writing_group();
DROP TABLE public.writing_group;

DROP FUNCTION public.delete_writing_group_after_last_user_leaves();

DROP TYPE public.user_in_writing_group_status;
DROP TYPE public.story_language;
DROP TYPE public.user_in_writing_group_role;
DROP TYPE public.writing_group_visibility;
DROP TYPE public.writing_group_story_status;
