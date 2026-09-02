-- migrate:up

CREATE TYPE public.report_target_type AS ENUM (
    'writing_group',
    'writing_thread',
    'writing_post',
    'writing_page',
    'story_idea',
    'chat_group',
    'chat_message',
    'user'
    );

-- The lifecycle, and only that. `resolved` and `dismissed` were two closings here once, but what
-- separated them is said far more precisely by `report_outcome`, so closing is one state and the
-- outcome carries which kind of closing it was. `in_progress` is a report in somebody's hands,
-- which is what stops two operators judging the same case.
--
-- Nothing ever writes this: `report.status` is a generated column over the two timestamps below,
-- so the type exists for what reads a report rather than for what stores one.
CREATE TYPE public.report_status AS ENUM ('open', 'in_progress', 'closed');

-- How a closing turned out, which is what `resolved` and `dismissed` used to say between them and
-- says it finely enough to be worth reading. Declared in full here for the same reason every
-- other enum in this schema is.
--
-- Upheld first, refused after, `other` last, like `report_category`'s order — but note this only
-- holds inside Postgres, which sorts an enum by declaration. `kysely-codegen` sorts these
-- alphabetically on the way out, so the order an operator actually reads is the frontend's own
-- list in `lib/format/report.ts`, exactly as it already is for the categories.
--
-- Two of these exist for this platform in particular. `content_warning_added` is what a
-- `missing_content_warning` report is usually answered with, so the answer names the same thing
-- the complaint did. And `target_gone` is a closing the queue can already see coming, since it
-- knows whether the reported thing still exists.
--
-- Whether an outcome upheld or refused the report is not a column of its own: nothing filters on
-- that yet, and it is recoverable from the value if anything ever does.
CREATE TYPE public.report_outcome AS ENUM (
    'content_removed',
    'account_banned',
    'warning_given',
    'content_warning_added',
    'no_violation',
    'duplicate',
    'insufficient_information',
    'target_gone',
    'other'
    );

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
    reported_writing_page_id   UUID                               REFERENCES public.writing_page (id) ON UPDATE CASCADE ON DELETE SET NULL,
    reported_story_idea_id     UUID                               REFERENCES public.story_idea (id) ON UPDATE CASCADE ON DELETE SET NULL,
    reported_chat_group_id     UUID                               REFERENCES public.chat_group (id) ON UPDATE CASCADE ON DELETE SET NULL,
    reported_chat_message_id   UUID                               REFERENCES public.chat_message (id) ON UPDATE CASCADE ON DELETE SET NULL,
    -- Named apart from reporter_id: both reference user, and confusing them would be a report
    -- filed against its own author.
    reported_user_id  UUID                               REFERENCES public.user (id) ON UPDATE CASCADE ON DELETE SET NULL,

    -- Who is answerable for the reported thing, resolved when the report is filed. Set for every
    -- target type, including `user`, where it is the reported account itself.
    --
    -- Without this a report survives its target and loses the one fact an operator needs to act:
    -- delete a reported post and `reported_writing_post_id` empties, leaving "somebody wrote
    -- this" and no way to reach them. `reported_user_id` only ever names a *member* who was
    -- reported, never the author of a reported post.
    --
    -- Not covered by the CHECK below, which is about the target columns: this one is always set,
    -- whatever the type.
    reported_author_id UUID                              REFERENCES public.user (id) ON UPDATE CASCADE ON DELETE SET NULL,

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

    -- Filing is the report's own `created_at`, so there is no `opened_at`: a report is open from
    -- the moment it exists.
    created_at        TIMESTAMPTZ               NOT NULL DEFAULT now(),

    -- The operator dealing with it: who took it, and who closed it, which under the one rule below
    -- are always the same person. SET NULL like every other actor here, and that is also the whole
    -- of the escape hatch — a report whose operator's account is gone is held by nobody, so
    -- anybody may close it.
    operator_id       UUID                               REFERENCES public.user (id) ON UPDATE CASCADE ON DELETE SET NULL,

    -- The lifecycle, as the two moments it consists of. Taking a report already taken is allowed
    -- and overwrites both this and `operator_id`: the point of the state is to say "somebody has
    -- this, move on", and a lock nobody can pick leaves a report stuck the day its holder stops
    -- reading the queue.
    in_progress_at    TIMESTAMPTZ,
    closed_at         TIMESTAMPTZ,

    -- What was decided. Both belong to a closing and neither can exist without one — see the
    -- CHECK. The note is mandatory there for the reason the reporter's own `reason` is mandatory
    -- beside their `category`: an outcome alone loses the detail that decided the case.
    closing_outcome   public.report_outcome,
    closing_note      TEXT,

    -- The status as a column, derived so it cannot disagree with the timestamps it describes.
    --
    -- The timestamps are the truth, but the queue filters on the status, indexes it, and sends it
    -- to a client that shows one of three labels — and written out by hand that filter is three
    -- different predicates, where forgetting `closed_at IS NULL` in the middle one silently
    -- includes every closed report that was ever taken. Generated, that class of mistake is gone
    -- and every reader stays a single equality.
    --
    -- `kysely-codegen` types this `Generated<ReportStatus>`, so nothing can try to insert it.
    status            public.report_status      NOT NULL GENERATED ALWAYS AS (
        CASE
            WHEN closed_at IS NOT NULL THEN 'closed'::public.report_status
            WHEN in_progress_at IS NOT NULL THEN 'in_progress'::public.report_status
            ELSE 'open'::public.report_status
            END
        ) STORED,

    -- A closed report says how it turned out, and one that is not closed cannot pretend to have.
    -- Written against the timestamp rather than the status because a generated column cannot be
    -- referenced by a CHECK on its own table.
    CONSTRAINT report_closed_has_an_outcome CHECK (
        (closed_at IS NOT NULL AND closing_outcome IS NOT NULL AND closing_note IS NOT NULL)
            OR (closed_at IS NULL AND closing_outcome IS NULL AND closing_note IS NULL)
        ),

    -- Closing cannot predate taking. Nothing in the application can produce it, and a row that
    -- said otherwise would make the queue's own history unreadable.
    CONSTRAINT report_closed_after_taken CHECK (
        in_progress_at IS NULL OR closed_at IS NULL OR closed_at >= in_progress_at
        ),

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
            WHEN 'writing_group' THEN num_nonnulls(reported_writing_page_id, reported_writing_thread_id, reported_writing_post_id, reported_story_idea_id, reported_chat_group_id, reported_chat_message_id, reported_user_id) = 0
            WHEN 'writing_thread' THEN num_nonnulls(reported_writing_page_id, reported_writing_group_id, reported_writing_post_id, reported_story_idea_id, reported_chat_group_id, reported_chat_message_id, reported_user_id) = 0
            WHEN 'writing_post' THEN num_nonnulls(reported_writing_page_id, reported_writing_group_id, reported_writing_thread_id, reported_story_idea_id, reported_chat_group_id, reported_chat_message_id, reported_user_id) = 0
            WHEN 'writing_page' THEN num_nonnulls(reported_writing_group_id, reported_writing_thread_id, reported_writing_post_id, reported_story_idea_id, reported_chat_group_id, reported_chat_message_id, reported_user_id) = 0
            WHEN 'story_idea' THEN num_nonnulls(reported_writing_page_id, reported_writing_group_id, reported_writing_thread_id, reported_writing_post_id, reported_chat_group_id, reported_chat_message_id, reported_user_id) = 0
            WHEN 'chat_group' THEN num_nonnulls(reported_writing_page_id, reported_writing_group_id, reported_writing_thread_id, reported_writing_post_id, reported_story_idea_id, reported_chat_message_id, reported_user_id) = 0
            WHEN 'chat_message' THEN num_nonnulls(reported_writing_page_id, reported_writing_group_id, reported_writing_thread_id, reported_writing_post_id, reported_story_idea_id, reported_chat_group_id, reported_user_id) = 0
            WHEN 'user' THEN num_nonnulls(reported_writing_page_id, reported_writing_group_id, reported_writing_thread_id, reported_writing_post_id, reported_story_idea_id, reported_chat_group_id, reported_chat_message_id) = 0
            ELSE false
            END
        )
);

-- One report per member per thing **per category**, which is the line between correcting a report
-- and making a second, different claim. Without the category in the key the two are
-- indistinguishable: a member who reported a post as harassment and then noticed it was also
-- plagiarism had the first claim silently overwritten by the second. Filing the same category
-- twice is the slip, and that still rewrites the reason.
--
-- A second member reporting the same thing is a different row either way, which is the count an
-- operator wants. A closed report does not block reporting the same thing again, if it happens
-- again. The bound on one member and one thing is therefore the size of `report_category`.
--
-- `closed_at IS NULL` rather than `status = 'open'`, because a report being worked on has to go on
-- blocking duplicates: while this asked for `open`, taking a report dropped it out of the index and
-- quietly let the same member file it again. It reads the timestamp rather than the generated
-- `status` because a partial index cannot have a generated column in its predicate.
-- `insertReport`'s ON CONFLICT clause restates this whole predicate, and Postgres refuses the
-- insert outright the moment the two disagree.
--
-- Three things this needs, and the last two exist because SET NULL can rewrite an indexed
-- column long after the row was written.
--
-- NULLS NOT DISTINCT, because seven of the eight target columns are always NULL and Postgres
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
CREATE UNIQUE INDEX report_one_open_per_reporter_and_category_idx
    ON public.report (reporter_id, category, reported_writing_group_id, reported_writing_thread_id, reported_writing_post_id,
                      reported_writing_page_id, reported_story_idea_id, reported_chat_group_id, reported_chat_message_id,
                      reported_user_id)
    NULLS NOT DISTINCT
    WHERE closed_at IS NULL
        AND reporter_id IS NOT NULL
        AND num_nonnulls(reported_writing_group_id, reported_writing_thread_id, reported_writing_post_id, reported_writing_page_id,
                         reported_story_idea_id, reported_chat_group_id, reported_chat_message_id, reported_user_id) = 1;

-- The queue reads open reports oldest first, and filters them by category and by how they closed.
CREATE INDEX report_status_created_idx ON public.report (status, created_at DESC);
CREATE INDEX report_status_category_idx ON public.report (status, category);
CREATE INDEX report_status_closing_outcome_idx ON public.report (status, closing_outcome);

-- All ten references, none led by an index above: the unique index leads with `reporter_id` but is
-- partial on `closed_at IS NULL`, so it cannot find a member's closed reports.
CREATE INDEX report_reporter_idx ON public.report (reporter_id)
    WHERE reporter_id IS NOT NULL;

CREATE INDEX report_reported_author_idx ON public.report (reported_author_id)
    WHERE reported_author_id IS NOT NULL;

CREATE INDEX report_operator_idx ON public.report (operator_id)
    WHERE operator_id IS NOT NULL;

CREATE INDEX report_reported_user_idx ON public.report (reported_user_id)
    WHERE reported_user_id IS NOT NULL;

CREATE INDEX report_reported_writing_group_idx ON public.report (reported_writing_group_id)
    WHERE reported_writing_group_id IS NOT NULL;

CREATE INDEX report_reported_writing_thread_idx ON public.report (reported_writing_thread_id)
    WHERE reported_writing_thread_id IS NOT NULL;

CREATE INDEX report_reported_writing_post_idx ON public.report (reported_writing_post_id)
    WHERE reported_writing_post_id IS NOT NULL;

CREATE INDEX report_reported_writing_page_idx ON public.report (reported_writing_page_id)
    WHERE reported_writing_page_id IS NOT NULL;

CREATE INDEX report_reported_story_idea_idx ON public.report (reported_story_idea_id)
    WHERE reported_story_idea_id IS NOT NULL;

CREATE INDEX report_reported_chat_group_idx ON public.report (reported_chat_group_id)
    WHERE reported_chat_group_id IS NOT NULL;

CREATE INDEX report_reported_chat_message_idx ON public.report (reported_chat_message_id)
    WHERE reported_chat_message_id IS NOT NULL;

-- migrate:down

DROP TABLE public.report;

DROP TYPE public.report_outcome;

DROP TYPE public.report_category;

DROP TYPE public.report_status;

DROP TYPE public.report_target_type;
