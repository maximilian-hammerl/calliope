-- migrate:up

-- Verifying an address and changing one will be further values here. Storing the purpose
-- keeps the kinds apart: a token issued to reset a password cannot be spent on anything else.
CREATE TYPE public.user_token_purpose AS ENUM ('password_reset');

CREATE TABLE public.user_token
(
    id           UUID PRIMARY KEY                   DEFAULT uuidv7(),
    user_id      UUID                      NOT NULL REFERENCES public.user (id) ON UPDATE CASCADE ON DELETE CASCADE,
    purpose      public.user_token_purpose NOT NULL,

    -- Hashed like user_session's, and looked up the same way: the link carries `id.token`, so
    -- the id finds the row and this only has to be compared.
    hashed_token bytea                     NOT NULL,

    expires_at   TIMESTAMPTZ               NOT NULL,
    consumed_at  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ               NOT NULL DEFAULT now()
);

-- Issuing a link revokes the previous one, so at most one is ever outstanding. The service
-- deletes before it inserts; this makes that an invariant rather than a habit.
CREATE UNIQUE INDEX user_token_one_outstanding_per_purpose
    ON public.user_token (user_id, purpose)
    WHERE consumed_at IS NULL;

CREATE INDEX user_token_user_id_idx ON public.user_token (user_id);

-- The expiry sweep deletes by this column alone.
CREATE INDEX user_token_expires_at_idx ON public.user_token (expires_at);

-- migrate:down

DROP TABLE public.user_token;

DROP TYPE public.user_token_purpose;
