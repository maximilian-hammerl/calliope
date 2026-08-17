-- migrate:up

ALTER TABLE public.writing_group
    ADD COLUMN last_activity_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.thread
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

CREATE FUNCTION public.set_last_activity_at_for_thread()
    RETURNS TRIGGER
    set search_path to ''
AS
$$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        UPDATE public.thread
        SET last_activity_at = now()
        WHERE id = OLD.thread_id;

    ELSE
        UPDATE public.thread
        SET last_activity_at = now()
        WHERE id = NEW.thread_id;

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

CREATE TRIGGER set_last_activity_at_for_writing_group
    AFTER INSERT OR UPDATE OR DELETE
    ON public.thread
    FOR EACH ROW
EXECUTE FUNCTION public.set_last_activity_at_for_writing_group();

CREATE TRIGGER set_last_activity_at
    BEFORE UPDATE
    ON public.thread
    FOR EACH ROW
EXECUTE FUNCTION public.set_last_activity_at();

CREATE TRIGGER set_last_activity_at_for_thread
    AFTER INSERT OR UPDATE OR DELETE
    ON public.post
    FOR EACH ROW
EXECUTE FUNCTION public.set_last_activity_at_for_thread();

-- migrate:down

DROP TRIGGER set_last_activity_at_for_thread ON public.post;
DROP TRIGGER set_last_activity_at ON public.thread;
DROP TRIGGER set_last_activity_at_for_writing_group ON public.thread;
DROP TRIGGER set_last_activity_at ON public.writing_group;

DROP FUNCTION public.set_last_activity_at_for_thread();
DROP FUNCTION public.set_last_activity_at_for_writing_group();
DROP FUNCTION public.set_last_activity_at();

ALTER TABLE public.thread
    DROP COLUMN last_activity_at;
ALTER TABLE public.writing_group
    DROP COLUMN last_activity_at;
