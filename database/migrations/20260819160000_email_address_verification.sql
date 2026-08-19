-- migrate:up

ALTER TABLE public.user
    ADD COLUMN email_address_verified_at TIMESTAMPTZ;

-- Accounts that predate verification keep their access. Demanding it retroactively would
-- lock out members who registered when no such rule existed.
UPDATE public.user
SET email_address_verified_at = now();

-- Last, because a value added to an enum cannot be used until the transaction commits.
ALTER TYPE public.user_token_purpose ADD VALUE 'email_address_verification';

-- migrate:down

-- Postgres cannot remove a value from an enum, so the type is rebuilt without it. Tokens of
-- the departing kind go first: the new type has no room for them.
DELETE
FROM public.user_token
WHERE purpose = 'email_address_verification';

ALTER TYPE public.user_token_purpose RENAME TO user_token_purpose_old;

CREATE TYPE public.user_token_purpose AS ENUM ('password_reset');

ALTER TABLE public.user_token
    ALTER COLUMN purpose TYPE public.user_token_purpose
        USING purpose::text::public.user_token_purpose;

DROP TYPE public.user_token_purpose_old;

ALTER TABLE public.user
    DROP COLUMN email_address_verified_at;
