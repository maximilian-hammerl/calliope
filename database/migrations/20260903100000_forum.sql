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

-- `effective_member_permission` is the database's to derive: a folder's own setting reduced by its
-- parent's, which is already reduced. Here rather than in a service, so no writer can supply a
-- wrong one and the reduction is written in one place.
--
-- `LEAST` *is* that reduction, given the enum's order above, and it ignores a null parent —
-- which is the root.

CREATE FUNCTION public.set_folder_effective_member_permission()
    RETURNS TRIGGER
    set search_path to ''
AS
$$
DECLARE
    parent_effective public.forum_permission;
BEGIN
    -- A writing group's folder carries neither column; its CHECK requires both to be null.
    IF NEW.writing_group_id IS NOT NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.parent_folder_id IS NOT NULL THEN
        SELECT effective_member_permission
        INTO parent_effective
        FROM public.writing_folder
        WHERE id = NEW.parent_folder_id;
    END IF;

    NEW.effective_member_permission := LEAST(NEW.member_permission, parent_effective);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_effective_member_permission
    BEFORE INSERT OR UPDATE OF member_permission, parent_folder_id, writing_group_id
    ON public.writing_folder
    FOR EACH ROW
EXECUTE FUNCTION public.set_folder_effective_member_permission();

-- The subtree follows, one level per firing: touching a child's own column is what makes its
-- BEFORE trigger recompute, so the reduction stays in one place. `UPDATE OF` fires on a column
-- being written rather than on its value changing, which is what the touch relies on.
CREATE FUNCTION public.cascade_folder_effective_member_permission()
    RETURNS TRIGGER
    set search_path to ''
AS
$$
BEGIN
    UPDATE public.writing_folder
    SET member_permission = member_permission
    WHERE parent_folder_id = NEW.id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Only where the value actually moved, which is what terminates the walk: a subtree whose
-- reduced values are unchanged stops the cascade rather than running to the leaves.
CREATE TRIGGER cascade_effective_member_permission
    AFTER UPDATE
    ON public.writing_folder
    FOR EACH ROW
    WHEN (OLD.effective_member_permission IS DISTINCT FROM NEW.effective_member_permission)
EXECUTE FUNCTION public.cascade_folder_effective_member_permission();

-- migrate:down


DROP TRIGGER cascade_effective_member_permission ON public.writing_folder;
DROP FUNCTION public.cascade_folder_effective_member_permission();

DROP TRIGGER set_effective_member_permission ON public.writing_folder;
DROP FUNCTION public.set_folder_effective_member_permission();

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
