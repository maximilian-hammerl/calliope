-- migrate:up

CREATE
EXTENSION pgcrypto;

CREATE FUNCTION public.set_updated_at() RETURNS TRIGGER AS
$$
BEGIN
    IF OLD IS DISTINCT FROM NEW THEN
        NEW.updated_at = now();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

---

CREATE TABLE public.user
(
    id              UUID PRIMARY KEY     DEFAULT uuidv7(),
    username        text UNIQUE NOT NULL,
    hashed_password text        not null,
    email_address   text UNIQUE NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at
    BEFORE UPDATE
    ON public.user
    FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

---

CREATE TABLE public.user_session
(
    id           UUID PRIMARY KEY     DEFAULT uuidv7(),
    user_id      UUID        NOT NULL REFERENCES public.user (id) ON UPDATE CASCADE ON DELETE CASCADE,
    hashed_token bytea       NOT NULL,
    expires_at   TIMESTAMPTZ NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at
    BEFORE UPDATE
    ON public.user_session
    FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- migrate:down

DROP TABLE public.user_session;
DROP TABLE public.user;

DROP FUNCTION public.set_updated_at();

DROP EXTENSION pgcrypto;
