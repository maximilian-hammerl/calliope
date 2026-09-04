-- migrate:up

-- The public forum (#32) reuses a writing group's tables; `writing_group_id IS NULL` is what
-- makes a row the forum's.

-- Ordered most restrictive first, so the values compare the way the rule reads — which lives in
-- `forum_permission.ts`, not here. Members only: an operator's access is `platform_role`.
CREATE TYPE public.forum_permission AS ENUM ('hidden', 'read', 'write');

ALTER TABLE public.writing_folder
    ALTER COLUMN writing_group_id DROP NOT NULL;
ALTER TABLE public.writing_thread
    ALTER COLUMN writing_group_id DROP NOT NULL;
ALTER TABLE public.writing_page
    ALTER COLUMN writing_group_id DROP NOT NULL;

---

-- No default: a group row must leave these null, and a default would break the CHECK below.
ALTER TABLE public.writing_folder
    -- What an operator set on this folder.
    ADD COLUMN member_permission           public.forum_permission,
    -- The same, reduced along the path: denormalised like `depth`, because search and favourites
    -- ask per row and a walk each time would not scale.
    ADD COLUMN effective_member_permission public.forum_permission,
    ADD CONSTRAINT writing_folder_permission_is_forum_only CHECK (
        (writing_group_id IS NULL) = (member_permission IS NOT NULL)
            AND (writing_group_id IS NULL) = (effective_member_permission IS NOT NULL)
        );

-- A leaf keeps only its own: its folder holds the reduced value, so the answer is a join. `write`
-- is what a new one gets, because it restricts nothing.
ALTER TABLE public.writing_thread
    ADD COLUMN member_permission public.forum_permission,
    ADD CONSTRAINT writing_thread_permission_is_forum_only CHECK (
        (writing_group_id IS NULL) = (member_permission IS NOT NULL)
        );
ALTER TABLE public.writing_page
    ADD COLUMN member_permission public.forum_permission,
    ADD CONSTRAINT writing_page_permission_is_forum_only CHECK (
        (writing_group_id IS NULL) = (member_permission IS NOT NULL)
        );

-- No index for the scope: the existing `writing_group_id` b-trees serve `IS NULL` too.

-- migrate:down

-- `SET NOT NULL` fails while forum rows exist, which is right: there is nowhere to put them.
ALTER TABLE public.writing_page
    DROP CONSTRAINT writing_page_permission_is_forum_only,
    DROP COLUMN member_permission,
    ALTER COLUMN writing_group_id SET NOT NULL;
ALTER TABLE public.writing_thread
    DROP CONSTRAINT writing_thread_permission_is_forum_only,
    DROP COLUMN member_permission,
    ALTER COLUMN writing_group_id SET NOT NULL;
ALTER TABLE public.writing_folder
    DROP CONSTRAINT writing_folder_permission_is_forum_only,
    DROP COLUMN member_permission,
    DROP COLUMN effective_member_permission,
    ALTER COLUMN writing_group_id SET NOT NULL;

DROP TYPE public.forum_permission;
