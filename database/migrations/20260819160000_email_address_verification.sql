-- migrate:up

ALTER TABLE public.user
    ADD COLUMN email_address_verified_at TIMESTAMPTZ;

-- Accounts that predate verification keep their access. Demanding it retroactively would
-- lock out members who registered when no such rule existed.
UPDATE public.user
SET email_address_verified_at = now();

-- migrate:down

ALTER TABLE public.user
    DROP COLUMN email_address_verified_at;
