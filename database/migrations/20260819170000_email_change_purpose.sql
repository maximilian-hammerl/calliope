-- migrate:up

-- Alone in its own migration, and not by preference. A value added to an enum cannot be
-- *used* until the transaction that added it commits, and the CHECK in the next migration
-- compares against it. Three ways to keep them together were tried and all are worse:
-- together they fail with "unsafe use of new value"; an inline COMMIT applies the schema and
-- records the version but still exits non-zero, which fails a deploy that actually worked;
-- and `transaction:false` fails the same way as the first, because the statements still reach
-- the driver as one implicit transaction.
ALTER TYPE public.user_token_purpose ADD VALUE 'email_change';

-- migrate:down

DELETE
FROM public.user_token
WHERE purpose = 'email_change';

ALTER TYPE public.user_token_purpose RENAME TO user_token_purpose_old;

CREATE TYPE public.user_token_purpose AS ENUM ('password_reset', 'email_verification');

ALTER TABLE public.user_token
    ALTER COLUMN purpose TYPE public.user_token_purpose
        USING purpose::text::public.user_token_purpose;

DROP TYPE public.user_token_purpose_old;
