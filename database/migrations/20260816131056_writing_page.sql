-- migrate:up

-- Reference material a group maintains, as against a thread, where posts accumulate and each
-- belongs to its author. A page is one body, changed in place. See #109.
CREATE TABLE public.writing_page
(
    id               UUID PRIMARY KEY     DEFAULT uuidv7(),
    writing_group_id UUID        NOT NULL REFERENCES public.writing_group (id) ON UPDATE CASCADE ON DELETE CASCADE,

    title            TEXT        NOT NULL,

    -- The same Tiptap document a post carries, so the editor and the renderer are shared.
    document         JSONB       NOT NULL,
    -- Derived by the server and never sent by the client, exactly as `writing_post.text` is:
    -- search and the length limit read prose, and neither can read a node tree.
    text             TEXT        NOT NULL,

    created_by       UUID        REFERENCES public.user (id) ON UPDATE CASCADE ON DELETE SET NULL,

    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Named as `writing_thread.last_activity_at` is, and used for the same ordering. Also what
    -- a second editor's write is checked against, so unlike a post's `edited_at` it is never null.
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Whoever wrote it last, to name in the refusal a stale write gets. Set by the service:
    -- the trigger maintains the time, and a trigger cannot know who asked.
    updated_by       UUID        REFERENCES public.user (id) ON UPDATE CASCADE ON DELETE SET NULL
);

-- `UPDATE OF …` so that moving a page between folders is not mistaken for writing in it:
-- the trigger runs only when one of these columns is in the statement's SET list. Without it a
-- move reordered the tree, reported „bearbeitet" for prose nobody had touched, and refused an
-- open editor's next save as stale because somebody else had moved the page.
CREATE TRIGGER set_last_activity_at
    BEFORE UPDATE OF title, document, text, updated_by
    ON public.writing_page
    FOR EACH ROW
EXECUTE FUNCTION public.set_last_activity_at();

-- The tree lists every page of a group, most recently written in first.
CREATE INDEX writing_page_writing_group_id_idx
    ON public.writing_page (writing_group_id, last_activity_at DESC);
CREATE INDEX writing_page_created_by_idx ON public.writing_page (created_by);
-- Partial: a page carries no editor until somebody changes it after creating it.
CREATE INDEX writing_page_updated_by_idx
    ON public.writing_page (updated_by) WHERE updated_by IS NOT NULL;

-- migrate:down

DROP TABLE public.writing_page;
