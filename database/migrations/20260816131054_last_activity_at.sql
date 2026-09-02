-- migrate:up

ALTER TABLE public.writing_group
    ADD COLUMN last_activity_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.writing_thread
    ADD COLUMN last_activity_at timestamptz NOT NULL DEFAULT now();

---

CREATE FUNCTION public.set_last_activity_at()
    RETURNS TRIGGER
    set search_path to ''
AS
$$
BEGIN
    IF OLD IS DISTINCT FROM NEW THEN
        NEW.last_activity_at = now();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION public.set_last_activity_at_for_writing_group()
    RETURNS TRIGGER
    set search_path to ''
AS
$$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        UPDATE public.writing_group
        SET last_activity_at = now()
        WHERE id = OLD.writing_group_id;

    ELSE
        UPDATE public.writing_group
        SET last_activity_at = now()
        WHERE id = NEW.writing_group_id;

    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- A draft is visible to nobody but its author, so writing one must not make the thread look
-- active. Without the exemption every autosave would move the thread and its group to
-- "zuletzt gerade eben" and reorder the group list, which is both untrue and a disclosure
-- that a particular member is composing right now.
--
-- Publishing still counts: it is an UPDATE whose NEW row has is_draft false. So does deleting
-- a published post. Only rows that are drafts at the moment they are written are skipped.
CREATE FUNCTION public.set_last_activity_at_for_writing_thread()
    RETURNS TRIGGER
    set search_path to ''
AS
$$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        IF OLD.is_draft THEN
            RETURN NULL;
        END IF;

        UPDATE public.writing_thread
        SET last_activity_at = now()
        WHERE id = OLD.writing_thread_id;

    ELSE
        IF NEW.is_draft THEN
            RETURN NULL;
        END IF;

        UPDATE public.writing_thread
        SET last_activity_at = now()
        WHERE id = NEW.writing_thread_id;

    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

---

CREATE TRIGGER set_last_activity_at
    BEFORE UPDATE
    ON public.writing_group
    FOR EACH ROW
EXECUTE FUNCTION public.set_last_activity_at();

-- `UPDATE OF title` for the same reason as the thread's own trigger below: moving a thread
-- into a folder is not activity in its group.
CREATE TRIGGER set_last_activity_at_for_writing_group
    AFTER INSERT OR UPDATE OF title OR DELETE
    ON public.writing_thread
    FOR EACH ROW
EXECUTE FUNCTION public.set_last_activity_at_for_writing_group();

-- Scoped to `title`, so re-parenting a thread does not read as writing in it — the same
-- reasoning as the draft exemption above. A rename still counts.
CREATE TRIGGER set_last_activity_at
    BEFORE UPDATE OF title
    ON public.writing_thread
    FOR EACH ROW
EXECUTE FUNCTION public.set_last_activity_at();

CREATE TRIGGER set_last_activity_at_for_writing_thread
    AFTER INSERT OR UPDATE OR DELETE
    ON public.writing_post
    FOR EACH ROW
EXECUTE FUNCTION public.set_last_activity_at_for_writing_thread();

-- migrate:down

DROP TRIGGER set_last_activity_at_for_writing_thread ON public.writing_post;
DROP TRIGGER set_last_activity_at ON public.writing_thread;
DROP TRIGGER set_last_activity_at_for_writing_group ON public.writing_thread;
DROP TRIGGER set_last_activity_at ON public.writing_group;

DROP FUNCTION public.set_last_activity_at_for_writing_thread();
DROP FUNCTION public.set_last_activity_at_for_writing_group();
DROP FUNCTION public.set_last_activity_at();

ALTER TABLE public.writing_thread
    DROP COLUMN last_activity_at;
ALTER TABLE public.writing_group
    DROP COLUMN last_activity_at;
