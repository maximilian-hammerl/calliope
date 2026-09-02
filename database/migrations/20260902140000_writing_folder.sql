-- migrate:up

-- What a group nests its threads and pages in, named by the members themselves. The only
-- branch: a thread and a page are always leaves, so recursion stays on this one small table.
-- See #110.
CREATE TABLE public.writing_folder
(
    id               UUID PRIMARY KEY     DEFAULT uuidv7(),
    writing_group_id UUID        NOT NULL REFERENCES public.writing_group (id) ON UPDATE CASCADE ON DELETE CASCADE,

    -- Null at the root. RESTRICT rather than CASCADE: only an empty folder may be deleted, and
    -- a subtree is unrecoverable with no edit history to undo it.
    parent_folder_id UUID REFERENCES public.writing_folder (id) ON UPDATE CASCADE ON DELETE RESTRICT,

    -- Counted from 1 at the root, so the bound reads as the number of levels a member gets.
    -- Written by the service from the parent's depth; the CHECK is what actually holds the line.
    depth            SMALLINT    NOT NULL CHECK (depth BETWEEN 1 AND 5),

    title            TEXT        NOT NULL,
    -- Optional and plain text: a line about what belongs in here, shown under the title in the
    -- group's own tree. Never a document — that is what a page is for.
    description      TEXT,

    created_by       UUID        REFERENCES public.user (id) ON UPDATE CASCADE ON DELETE SET NULL,

    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Siblings are read in creation order, which is the whole tree's ordering for folders.
CREATE INDEX writing_folder_writing_group_id_idx
    ON public.writing_folder (writing_group_id, created_at);
-- Both a parent's children and the emptiness check read this.
CREATE INDEX writing_folder_parent_folder_id_idx
    ON public.writing_folder (parent_folder_id) WHERE parent_folder_id IS NOT NULL;
CREATE INDEX writing_folder_created_by_idx ON public.writing_folder (created_by);

---

-- Null means the root, so every existing thread and page stays where it is with nothing to
-- backfill. RESTRICT for the reason above: a folder holding either of these is not empty.
ALTER TABLE public.writing_thread
    ADD COLUMN folder_id UUID REFERENCES public.writing_folder (id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE public.writing_page
    ADD COLUMN folder_id UUID REFERENCES public.writing_folder (id) ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE INDEX writing_thread_folder_id_idx
    ON public.writing_thread (folder_id) WHERE folder_id IS NOT NULL;
CREATE INDEX writing_page_folder_id_idx
    ON public.writing_page (folder_id) WHERE folder_id IS NOT NULL;

-- migrate:down

DROP INDEX public.writing_page_folder_id_idx;
DROP INDEX public.writing_thread_folder_id_idx;

ALTER TABLE public.writing_page
    DROP COLUMN folder_id;
ALTER TABLE public.writing_thread
    DROP COLUMN folder_id;

DROP TABLE public.writing_folder;
