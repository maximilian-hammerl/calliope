-- migrate:up

-- A ban is an operator stopping an account for breaking the platform's rules. Deliberately not
-- a deletion: deleting frees the name and the address — the closing mail says so outright — and
-- a banned address must stay held, which it does for free because the row survives and
-- email_address is UNIQUE.
--
-- Columns on user rather than a table of their own, for the same reason platform_role is: the
-- session path already loads this row, so refusing a banned member costs no query. A ban has no
-- history here; when one is wanted, #23's queue is where acting on an account gets recorded.
ALTER TABLE public.user
    -- Null is the resting state: not banned.
    ADD COLUMN banned_at  TIMESTAMPTZ,
    -- Nullable even for a banned account: the operator's own account may be deleted later, and
    -- losing who did it must not lift the ban.
    ADD COLUMN banned_by  UUID REFERENCES public.user (id) ON UPDATE CASCADE ON DELETE SET NULL,
    -- Written for the operators, not for the banned member — nothing shows it to them.
    ADD COLUMN ban_reason TEXT;

-- The three columns describe one fact, so they cannot disagree: a reason without a ban, or a
-- ban with no reason recorded, are both states nobody could act on later.
ALTER TABLE public.user
    ADD CONSTRAINT user_ban_is_complete CHECK (
        (banned_at IS NULL AND ban_reason IS NULL AND banned_by IS NULL)
            OR (banned_at IS NOT NULL AND ban_reason IS NOT NULL)
        );

-- Partial: `banned_by` is null on all but a handful of accounts.
CREATE INDEX user_banned_by_idx ON public.user (banned_by) WHERE banned_by IS NOT NULL;

-- migrate:down

DROP INDEX public.user_banned_by_idx;

ALTER TABLE public.user
    DROP CONSTRAINT user_ban_is_complete;

ALTER TABLE public.user
    DROP COLUMN ban_reason,
    DROP COLUMN banned_by,
    DROP COLUMN banned_at;
