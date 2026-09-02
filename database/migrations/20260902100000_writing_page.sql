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

    -- Not `edited_at`, which a post uses to tell a reader it changed and is null until then.
    -- This is what a second editor's write is checked against, so it always holds a value.
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Whoever wrote it last, to name in the refusal a stale write gets. Set by the service:
    -- `set_updated_at` maintains the time, and a trigger cannot know who asked.
    updated_by       UUID        REFERENCES public.user (id) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TRIGGER set_updated_at
    BEFORE UPDATE
    ON public.writing_page
    FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- The rail lists every page of a group, newest last.
CREATE INDEX writing_page_writing_group_id_idx ON public.writing_page (writing_group_id, created_at);
CREATE INDEX writing_page_created_by_idx ON public.writing_page (created_by);
-- Partial: a page carries no editor until somebody changes it after creating it.
CREATE INDEX writing_page_updated_by_idx
    ON public.writing_page (updated_by) WHERE updated_by IS NOT NULL;

-- migrate:down

DROP TABLE public.writing_page;
