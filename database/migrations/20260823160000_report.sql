-- migrate:up

CREATE TYPE public.report_target_type AS ENUM (
    'writing_group',
    'writing_thread',
    'writing_post',
    'story_idea',
    'chat_group',
    'chat_message',
    'user'
    );

CREATE TYPE public.report_status AS ENUM ('open', 'resolved', 'dismissed');

-- Why something is being reported, so the queue can be filtered and grouped without reading
-- every report. Every value is declared here rather than added later: a value added to an enum
-- cannot be used until its transaction commits, which is the same reason `user_token_purpose`
-- lists all four of its own.
--
-- Two of these exist because this is a *fiction* platform with content warnings, which is what
-- makes the usual list from elsewhere a poor fit. Violence and sexual content are legitimate
-- subject matter here; what is reportable is that they were not declared, hence
-- `missing_content_warning`. And `plagiarism` is one of the likeliest real reports on a site
-- where people publish prose, and appears on nobody else's list.
CREATE TYPE public.report_category AS ENUM (
    'harassment',
    'hate',
    'violence',
    'sexual_content',
    'self_harm',
    'illegal_content',
    'missing_content_warning',
    'plagiarism',
    'spam',
    'legal_issue',
    'other'
    );

-- What a member has reported to the operators, in `notification`'s shape: one nullable column
-- per kind, keyed off a type column and constrained by a CHECK.
--
-- It differs from that table in one way, and everything awkward here follows from it. A
-- notification about something deleted is noise and cascades away; a report must *outlive* its
-- target, or deleting your own post the moment it is reported erases the evidence. So the
-- foreign keys are ON DELETE SET NULL, and the row stays with `target_type`, the excerpt and the
-- reason after the thing itself is gone.
CREATE TABLE public.report
(
    id                UUID PRIMARY KEY                   DEFAULT uuidv7(),

    -- SET NULL, not CASCADE: deleting your account does not withdraw what you reported. The
    -- operator loses who it was, not the report.
    reporter_id       UUID                               REFERENCES public.user (id) ON UPDATE CASCADE ON DELETE SET NULL,

    target_type       public.report_target_type NOT NULL,

    -- Exactly one of these is set when the report is filed, decided by `target_type`. Each may
    -- later become NULL when the thing it names is deleted, which is the point — see the CHECK.
    reported_writing_group_id  UUID                               REFERENCES public.writing_group (id) ON UPDATE CASCADE ON DELETE SET NULL,
    reported_writing_thread_id UUID                               REFERENCES public.writing_thread (id) ON UPDATE CASCADE ON DELETE SET NULL,
    reported_writing_post_id   UUID                               REFERENCES public.writing_post (id) ON UPDATE CASCADE ON DELETE SET NULL,
    reported_story_idea_id     UUID                               REFERENCES public.story_idea (id) ON UPDATE CASCADE ON DELETE SET NULL,
    reported_chat_group_id     UUID                               REFERENCES public.chat_group (id) ON UPDATE CASCADE ON DELETE SET NULL,
    reported_chat_message_id   UUID                               REFERENCES public.chat_message (id) ON UPDATE CASCADE ON DELETE SET NULL,
    -- Named apart from reporter_id: both reference user, and confusing them would be a report
    -- filed against its own author.
    reported_user_id  UUID                               REFERENCES public.user (id) ON UPDATE CASCADE ON DELETE SET NULL,

    -- What the reported thing said when it was reported, so the queue is still usable once the
    -- content is gone. Written by the server from what the reporter could see, never sent by the
    -- client — a snapshot the reporter composed would be evidence they wrote themselves.
    --
    -- A copy of somebody's words held outside the thing they wrote, so it needs a retention rule
    -- alongside the rest of §18.
    target_excerpt    TEXT                      NOT NULL,

    -- The category is what the queue filters and groups on; the reason is what an operator
    -- reads. Both are required — a category alone loses the detail that usually decides a case,
    -- and free text alone means reading every report to know what it is about.
    category          public.report_category    NOT NULL,
    reason            TEXT                      NOT NULL,

    status            public.report_status      NOT NULL DEFAULT 'open',

    created_at        TIMESTAMPTZ               NOT NULL DEFAULT now(),

    -- The polymorphism as a constraint, with the one concession SET NULL forces: this says that
    -- **no column other than the matching one is set**, rather than that the matching one is.
    -- "Exactly one" would be violated by the deletion this table exists to survive. Filing a
    -- report with the matching column empty is prevented by the service, which cannot build the
    -- excerpt without reading the target.
    --
    -- `ELSE false` matters: a CHECK passes when its expression is NULL, so a CASE with no
    -- matching branch would let a new target type through unchecked rather than stopping it.
    CONSTRAINT report_target_matches_type CHECK (
        CASE target_type
            WHEN 'writing_group' THEN num_nonnulls(reported_writing_thread_id, reported_writing_post_id, reported_story_idea_id, reported_chat_group_id, reported_chat_message_id, reported_user_id) = 0
            WHEN 'writing_thread' THEN num_nonnulls(reported_writing_group_id, reported_writing_post_id, reported_story_idea_id, reported_chat_group_id, reported_chat_message_id, reported_user_id) = 0
            WHEN 'writing_post' THEN num_nonnulls(reported_writing_group_id, reported_writing_thread_id, reported_story_idea_id, reported_chat_group_id, reported_chat_message_id, reported_user_id) = 0
            WHEN 'story_idea' THEN num_nonnulls(reported_writing_group_id, reported_writing_thread_id, reported_writing_post_id, reported_chat_group_id, reported_chat_message_id, reported_user_id) = 0
            WHEN 'chat_group' THEN num_nonnulls(reported_writing_group_id, reported_writing_thread_id, reported_writing_post_id, reported_story_idea_id, reported_chat_message_id, reported_user_id) = 0
            WHEN 'chat_message' THEN num_nonnulls(reported_writing_group_id, reported_writing_thread_id, reported_writing_post_id, reported_story_idea_id, reported_chat_group_id, reported_user_id) = 0
            WHEN 'user' THEN num_nonnulls(reported_writing_group_id, reported_writing_thread_id, reported_writing_post_id, reported_story_idea_id, reported_chat_group_id, reported_chat_message_id) = 0
            ELSE false
            END
        )
);

-- One open report per member per thing. Filing the same one twice is a slip; a second member
-- reporting it is a different row, which is the count an operator wants. A resolved report does
-- not block reporting the same thing again, if it happens again.
--
-- Three things this needs, and the last two exist because SET NULL can rewrite an indexed
-- column long after the row was written.
--
-- NULLS NOT DISTINCT, because six of the seven target columns are always NULL and Postgres
-- would otherwise treat every row as unique.
--
-- `reporter_id IS NOT NULL`, or two reports of the same thing by two different members collide
-- the moment both reporters delete their accounts — and the collision fails the *deletion*, so
-- a member could be unable to leave because somebody else reported the same thing they did.
--
-- `num_nonnulls(...) = 1` for the mirror of that on the other side: deleting a second reported
-- post would null that row's last target column and collide with the first all-NULL row.
--
-- Both predicates say the same thing in the end: this index is about live members reporting
-- things that still exist, which is the only situation in which filing twice is possible.
CREATE UNIQUE INDEX report_one_open_per_reporter_idx
    ON public.report (reporter_id, reported_writing_group_id, reported_writing_thread_id, reported_writing_post_id,
                      reported_story_idea_id, reported_chat_group_id, reported_chat_message_id, reported_user_id)
    NULLS NOT DISTINCT
    WHERE status = 'open'
        AND reporter_id IS NOT NULL
        AND num_nonnulls(reported_writing_group_id, reported_writing_thread_id, reported_writing_post_id, reported_story_idea_id,
                         reported_chat_group_id, reported_chat_message_id, reported_user_id) = 1;

-- The queue reads open reports newest first, and filters them by category.
CREATE INDEX report_status_created_idx ON public.report (status, created_at DESC);
CREATE INDEX report_status_category_idx ON public.report (status, category);

-- migrate:down

DROP TABLE public.report;

DROP TYPE public.report_category;

DROP TYPE public.report_status;

DROP TYPE public.report_target_type;
