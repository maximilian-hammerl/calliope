-- migrate:up

-- §11's other half of "blocking/reporting". Reporting waits for a moderation queue to land in;
-- a block needs nothing but this table, and closes the invitation spam the invite-based design
-- leaves as its residual.
CREATE TABLE public.user_block
(
    -- Who blocked, and whom. Both CASCADE: a block is about two living accounts, and there is
    -- nothing to remember about a deleted one.
    blocker_id UUID        NOT NULL REFERENCES public.user (id) ON UPDATE CASCADE ON DELETE CASCADE,
    blocked_id UUID        NOT NULL REFERENCES public.user (id) ON UPDATE CASCADE ON DELETE CASCADE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- One row per pair, which makes blocking twice a no-op rather than a duplicate.
    PRIMARY KEY (blocker_id, blocked_id),

    -- Same shape as the notification table's actor/recipient rule: nobody blocks themselves.
    CONSTRAINT user_block_not_self CHECK (blocker_id <> blocked_id)
);

-- Contact is refused in both directions, so the reverse lookup is as hot as the primary key's.
CREATE INDEX user_block_blocked_idx ON public.user_block (blocked_id);

-- migrate:down

DROP TABLE public.user_block;
