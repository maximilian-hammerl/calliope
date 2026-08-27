-- migrate:up

CREATE TABLE public.writing_thread
(
    id               UUID PRIMARY KEY     DEFAULT uuidv7(),
    writing_group_id UUID        NOT NULL REFERENCES public.writing_group (id) ON UPDATE CASCADE ON DELETE CASCADE,

    title            TEXT        NOT NULL,

    created_by       uuid        references public.user (id) on update cascade on delete set null,

    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

---

CREATE TABLE public.writing_post
(
    id                UUID PRIMARY KEY     DEFAULT uuidv7(),
    writing_thread_id UUID        NOT NULL REFERENCES public.writing_thread (id) ON UPDATE CASCADE ON DELETE CASCADE,

    -- What the author wrote, as a Tiptap document: the ProseMirror node tree, stored as the
    -- editor emits it. Never HTML — a stored `style="…"` would need a sanitiser that permits
    -- inline CSS, and the vocabulary here is a closed allowlist that rejects instead.
    document          JSONB       NOT NULL,

    -- The prose of `document`, extracted and written by the server, never sent by the client —
    -- the same rule `report.target_excerpt` follows, for the same reason.
    --
    -- It exists because three things read a post as text and none of them can read a tree:
    -- `ILIKE` search, the report excerpt, and the length limit. Deriving it here keeps all
    -- three working untouched, which is why the column keeps its old name.
    text              TEXT        NOT NULL,

    is_draft          BOOLEAN     NOT NULL,

    created_by        UUID        REFERENCES public.user (id) ON UPDATE CASCADE ON DELETE SET NULL,

    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Null until the post is changed after it was published, which is the only edit a reader
    -- is told about ("· bearbeitet"). Writing a draft is not an edit, and neither is
    -- publishing one. Stated outright rather than inferred from two timestamps disagreeing,
    -- which could not tell those three apart.
    edited_at         TIMESTAMPTZ,
    -- Because `mayModify` lets two different people edit — the author, or somebody
    -- administering the group — so who did it is not implied by the row. Asymmetric like
    -- `writing_group_next_step`: an editor implies a time, a time outlives its editor.
    edited_by         UUID        REFERENCES public.user (id) ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT writing_post_editor_needs_time CHECK (
        edited_by IS NULL OR edited_at IS NOT NULL
        )
);

---

CREATE INDEX writing_thread_writing_group_id_idx ON public.writing_thread (writing_group_id);
CREATE INDEX writing_thread_created_by_idx ON public.writing_thread (created_by);
CREATE INDEX writing_post_writing_thread_id_idx ON public.writing_post (writing_thread_id);
CREATE INDEX writing_post_created_by_idx ON public.writing_post (created_by);
-- Partial, unlike its neighbour above: most posts are never edited.
CREATE INDEX writing_post_edited_by_idx
    ON public.writing_post (edited_by) WHERE edited_by IS NOT NULL;

-- The composer holds exactly one draft per thread, so two tabs cannot quietly leave a second
-- one behind. Authors are compared as ids: a draft whose author was deleted has created_by
-- NULL, and NULLs are distinct here, which is right — such a row is unreachable anyway.
CREATE UNIQUE INDEX writing_post_one_draft_per_author
    ON public.writing_post (writing_thread_id, created_by)
    WHERE is_draft;

-- migrate:down

DROP TABLE public.writing_post;
DROP TABLE public.writing_thread;
