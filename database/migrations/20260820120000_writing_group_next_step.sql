-- migrate:up

CREATE TABLE public.writing_group_next_step
(
    id               UUID PRIMARY KEY     DEFAULT uuidv7(),
    writing_group_id UUID        NOT NULL REFERENCES public.writing_group (id) ON UPDATE CASCADE ON DELETE CASCADE,

    text             TEXT        NOT NULL,

    created_by       UUID        REFERENCES public.user (id) ON UPDATE CASCADE ON DELETE SET NULL,

    completed_at     TIMESTAMPTZ,
    -- Asymmetric on purpose: a completer without a time is impossible, but a time without a
    -- completer is what deleting the completer's account leaves behind (ON DELETE SET NULL).
    completed_by     UUID        REFERENCES public.user (id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT writing_group_next_step_completer_needs_time CHECK (
        completed_by IS NULL OR completed_at IS NOT NULL
        ),

    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The list is read per group, open steps by age, completed ones by completion.
CREATE INDEX writing_group_next_step_group_idx
    ON public.writing_group_next_step (writing_group_id, completed_at, created_at);
-- Partial: a step carries no completer until somebody ticks it.
CREATE INDEX writing_group_next_step_created_by_idx
    ON public.writing_group_next_step (created_by) WHERE created_by IS NOT NULL;

CREATE INDEX writing_group_next_step_completed_by_idx
    ON public.writing_group_next_step (completed_by) WHERE completed_by IS NOT NULL;

-- migrate:down

DROP TABLE public.writing_group_next_step;
