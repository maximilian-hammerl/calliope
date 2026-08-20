-- migrate:up

-- Where a requested address waits until the link sent to it is opened. On the token rather
-- than on `user`, because its lifetime is the token's: the hourly sweep takes both together,
-- where a column on `user` would be left claiming a change nothing can complete.
ALTER TABLE public.user_token
    ADD COLUMN new_email_address text,
    ADD CONSTRAINT user_token_new_email_address_matches_purpose CHECK (
        CASE purpose
            WHEN 'email_address_change' THEN new_email_address IS NOT NULL
            WHEN 'password_reset' THEN new_email_address IS NULL
            WHEN 'email_address_verification' THEN new_email_address IS NULL
            WHEN 'account_deletion' THEN new_email_address IS NULL
            -- `ELSE false` rather than a catch-all: a purpose added later with no branch is
            -- rejected, so adding one forces the decision instead of slipping through.
            ELSE false
            END
        );

-- migrate:down

ALTER TABLE public.user_token
    DROP CONSTRAINT user_token_new_email_address_matches_purpose,
    DROP COLUMN new_email_address;
