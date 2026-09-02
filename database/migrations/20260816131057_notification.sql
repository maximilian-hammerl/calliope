-- migrate:up

CREATE TYPE public.notification_type AS ENUM (
    'invited_to_writing_group',
    'invitation_accepted',
    'role_changed_in_writing_group',
    'visibility_changed_in_writing_group',
    'new_writing_thread',
    'new_writing_post',
    'new_writing_page',
    'invited_to_chat_group'
    );

CREATE TABLE public.notification
(
    id                UUID PRIMARY KEY                  DEFAULT uuidv7(),

    recipient_id      UUID                     NOT NULL REFERENCES public.user (id) ON UPDATE CASCADE ON DELETE CASCADE,
    type              public.notification_type NOT NULL,

    -- Who caused it. SET NULL rather than CASCADE: "Gelöschtes Konto hat dich eingeladen" is
    -- still worth reading.
    actor_id          UUID                              REFERENCES public.user (id) ON UPDATE CASCADE ON DELETE SET NULL,

    -- Exactly one of these is set, decided by `type` and enforced below. Each is half of a
    -- membership key, so a notification cannot outlive the recipient's place in whatever it is
    -- about. Neither has a foreign key of its own: the composite ones already guarantee a
    -- membership, which guarantees the group.
    writing_group_id  UUID,
    chat_group_id     UUID,

    writing_thread_id UUID                              REFERENCES public.writing_thread (id) ON UPDATE CASCADE ON DELETE CASCADE,
    writing_page_id   UUID                              REFERENCES public.writing_page (id) ON UPDATE CASCADE ON DELETE CASCADE,
    writing_post_id   UUID                              REFERENCES public.writing_post (id) ON UPDATE CASCADE ON DELETE CASCADE,

    created_at        TIMESTAMPTZ              NOT NULL DEFAULT now(),

    -- When the event this describes last happened, which is not the same as when the row
    -- appeared: a second role change updates the one notification in place. Occurrence types
    -- never move it, so for them the two always agree. The list is ordered by this one.
    occurred_at       TIMESTAMPTZ              NOT NULL DEFAULT now(),

    read_at           TIMESTAMPTZ,

    -- Cleans up after a withdrawn invitation, after leaving, and after being removed — and
    -- makes a notification about a group you do not belong to impossible to store, which is
    -- otherwise an access check every read would have to remember.
    FOREIGN KEY (recipient_id, writing_group_id)
        REFERENCES public.user_in_writing_group (user_id, writing_group_id)
        ON UPDATE CASCADE ON DELETE CASCADE,

    -- A composite foreign key with a NULL column is satisfied vacuously, so the two coexist:
    -- whichever group column is set is the one that is enforced.
    FOREIGN KEY (recipient_id, chat_group_id)
        REFERENCES public.user_in_chat_group (user_id, chat_group_id)
        ON UPDATE CASCADE ON DELETE CASCADE,

    -- The polymorphism, as a constraint rather than a convention. A new type with no branch
    -- here yields NULL and is rejected, so adding one forces the decision.
    -- The polymorphism, as a constraint rather than a convention. `ELSE false` matters: a
    -- CHECK passes when its expression is NULL, so a CASE with no matching branch would let a
    -- new type through unchecked rather than stopping it.
    CONSTRAINT notification_subject_matches_type CHECK (
        CASE type
            WHEN 'invited_to_writing_group' THEN
                writing_group_id IS NOT NULL AND chat_group_id IS NULL
                    AND writing_thread_id IS NULL AND writing_post_id IS NULL
                    AND writing_page_id IS NULL
            WHEN 'invitation_accepted' THEN
                writing_group_id IS NOT NULL AND chat_group_id IS NULL
                    AND writing_thread_id IS NULL AND writing_post_id IS NULL
                    AND writing_page_id IS NULL
            WHEN 'visibility_changed_in_writing_group' THEN
                writing_group_id IS NOT NULL AND chat_group_id IS NULL
                    AND writing_thread_id IS NULL AND writing_post_id IS NULL
                    AND writing_page_id IS NULL
            WHEN 'role_changed_in_writing_group' THEN
                writing_group_id IS NOT NULL AND chat_group_id IS NULL
                    AND writing_thread_id IS NULL AND writing_post_id IS NULL
                    AND writing_page_id IS NULL
            WHEN 'new_writing_thread' THEN
                writing_group_id IS NOT NULL AND chat_group_id IS NULL
                    AND writing_thread_id IS NOT NULL AND writing_post_id IS NULL
                    AND writing_page_id IS NULL
            WHEN 'new_writing_post' THEN
                writing_group_id IS NOT NULL AND chat_group_id IS NULL
                    AND writing_thread_id IS NOT NULL AND writing_post_id IS NOT NULL
                    AND writing_page_id IS NULL
            WHEN 'new_writing_page' THEN
                writing_group_id IS NOT NULL AND chat_group_id IS NULL
                    AND writing_thread_id IS NULL AND writing_post_id IS NULL
                    AND writing_page_id IS NOT NULL
            -- A chat needs no per-message notification: the chat list counts unread from
            -- last_read_at, and a row per message would say the same thing twice, loudly.
            WHEN 'invited_to_chat_group' THEN
                chat_group_id IS NOT NULL AND writing_group_id IS NULL
                    AND writing_thread_id IS NULL AND writing_post_id IS NULL
                    AND writing_page_id IS NULL
            ELSE false
            END
        ),

    -- Nobody is told about their own doing.
    CONSTRAINT notification_actor_is_not_recipient CHECK (actor_id IS DISTINCT FROM recipient_id)
);

---

-- Some notifications are about a state rather than an occurrence: you have one role in a
-- group and one invitation to it, however many times either changed. Those collapse onto a
-- single row whose occurred_at moves, which is also what lets the role itself be joined from
-- the membership instead of stored — one row always describes the latest change.
CREATE UNIQUE INDEX notification_one_role_change_per_membership
    ON public.notification (recipient_id, writing_group_id)
    WHERE type = 'role_changed_in_writing_group';

-- Visibility is a state as much as a role is: what matters is what the group is now, not the
-- sequence of flips that got it there. One row, whose occurred_at moves.
CREATE UNIQUE INDEX notification_one_visibility_change_per_membership
    ON public.notification (recipient_id, writing_group_id)
    WHERE type = 'visibility_changed_in_writing_group';

CREATE INDEX notification_recipient_id_occurred_at_idx
    ON public.notification (recipient_id, occurred_at DESC);

-- The unread count runs on every page, so it gets its own small partial index.
CREATE INDEX notification_unread_idx
    ON public.notification (recipient_id) WHERE read_at IS NULL;

-- The three references nothing above leads with. `writing_group_id` and `chat_group_id` need
-- none: each is half of a composite keyed on `recipient_id`, which the index above already leads.
CREATE INDEX notification_actor_idx ON public.notification (actor_id)
    WHERE actor_id IS NOT NULL;

CREATE INDEX notification_writing_thread_idx ON public.notification (writing_thread_id)
    WHERE writing_thread_id IS NOT NULL;

CREATE INDEX notification_writing_post_idx ON public.notification (writing_post_id)
    WHERE writing_post_id IS NOT NULL;

-- migrate:down

DROP TABLE public.notification;
DROP TYPE public.notification_type;
