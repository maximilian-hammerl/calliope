-- migrate:up

CREATE TABLE public.chat_group
(
    id               UUID PRIMARY KEY     DEFAULT uuidv7(),

    title            TEXT        NOT NULL,

    created_by       UUID                 REFERENCES public.user (id) ON UPDATE CASCADE ON DELETE SET NULL,

    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

---

CREATE TYPE public.user_in_chat_group_status AS ENUM ('invited', 'joined');

CREATE TABLE public.user_in_chat_group
(
    user_id       UUID                              NOT NULL REFERENCES public.user (id) ON UPDATE CASCADE ON DELETE CASCADE,
    chat_group_id UUID                              NOT NULL REFERENCES public.chat_group (id) ON UPDATE CASCADE ON DELETE CASCADE,
    PRIMARY KEY (user_id, chat_group_id),

    status        public.user_in_chat_group_status  NOT NULL,

    invited_at    TIMESTAMPTZ,
    joined_at     TIMESTAMPTZ,

    -- How far this member has read. One timestamp per membership rather than a receipt per
    -- message per member: unread is then a comparison, not a join over everything ever said.
    last_read_at  TIMESTAMPTZ,

    created_at    TIMESTAMPTZ                       NOT NULL DEFAULT now()
);

---

-- The counterpart of the writing-group function. Joining is a transition rather than only an
-- insert, so this covers both: a member invited on Monday and accepting on Wednesday is
-- UPDATEd, and Wednesday is what joined_at means.
CREATE FUNCTION public.set_invited_joined_at_for_user_in_chat_group()
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

CREATE TRIGGER set_invited_joined_at_for_user_in_chat_group
    BEFORE INSERT OR UPDATE
    ON public.user_in_chat_group
    FOR EACH ROW
EXECUTE FUNCTION public.set_invited_joined_at_for_user_in_chat_group();

---

CREATE TABLE public.chat_message
(
    id            UUID PRIMARY KEY     DEFAULT uuidv7(),
    chat_group_id UUID        NOT NULL REFERENCES public.chat_group (id) ON UPDATE CASCADE ON DELETE CASCADE,

    text          TEXT        NOT NULL,

    created_by    UUID                 REFERENCES public.user (id) ON UPDATE CASCADE ON DELETE SET NULL,

    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

---

-- An empty chat is nobody's, the same as an empty writing group.
CREATE FUNCTION public.delete_chat_group_after_last_user_leaves()
    RETURNS TRIGGER
    set search_path to ''
AS
$$
BEGIN
    -- Two members leaving at once would otherwise each still see the other's row, so neither
    -- deletes and the chat is left with nobody in it. Taking the row lock first serialises
    -- them; the DELETE below is a separate statement and so re-reads.
    PERFORM 1
    FROM public.chat_group
    WHERE id = OLD.chat_group_id
        FOR UPDATE;

    DELETE
    FROM public.chat_group AS cg
    WHERE cg.id = OLD.chat_group_id
      AND NOT EXISTS (SELECT true FROM public.user_in_chat_group AS uicg WHERE uicg.chat_group_id = cg.id);

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER delete_chat_group_after_last_user_leaves
    AFTER DELETE
    ON public.user_in_chat_group
    FOR EACH ROW
EXECUTE FUNCTION public.delete_chat_group_after_last_user_leaves();

---

CREATE FUNCTION public.set_last_activity_at_for_chat_group()
    RETURNS TRIGGER
    set search_path to ''
AS
$$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        UPDATE public.chat_group
        SET last_activity_at = now()
        WHERE id = OLD.chat_group_id;

    ELSE
        UPDATE public.chat_group
        SET last_activity_at = now()
        WHERE id = NEW.chat_group_id;

    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_last_activity_at_for_chat_group
    AFTER INSERT OR UPDATE OR DELETE
    ON public.chat_message
    FOR EACH ROW
EXECUTE FUNCTION public.set_last_activity_at_for_chat_group();

-- Reuses the shared function from the last_activity_at migration, which only touches NEW.
CREATE TRIGGER set_last_activity_at
    BEFORE UPDATE
    ON public.chat_group
    FOR EACH ROW
EXECUTE FUNCTION public.set_last_activity_at();

---

CREATE INDEX chat_group_created_by_idx ON public.chat_group (created_by);
-- Partial like the other reference indexes, though this column is set on all but the messages of
-- deleted accounts.
CREATE INDEX chat_message_created_by_idx
    ON public.chat_message (created_by) WHERE created_by IS NOT NULL;
-- The primary key leads with user_id, so listing a chat's members cannot use it.
CREATE INDEX user_in_chat_group_chat_group_id_idx
    ON public.user_in_chat_group (chat_group_id);
-- uuidv7 is time-ordered, so this one index serves both the ordering and the keyset cursor
-- that pages back through a conversation.
CREATE INDEX chat_message_chat_group_id_id_idx
    ON public.chat_message (chat_group_id, id DESC);

-- migrate:down

DROP TABLE public.chat_message;
DROP TABLE public.user_in_chat_group;
DROP TABLE public.chat_group;
DROP FUNCTION public.set_invited_joined_at_for_user_in_chat_group();
DROP FUNCTION public.delete_chat_group_after_last_user_leaves();
DROP FUNCTION public.set_last_activity_at_for_chat_group();
DROP TYPE public.user_in_chat_group_status;
