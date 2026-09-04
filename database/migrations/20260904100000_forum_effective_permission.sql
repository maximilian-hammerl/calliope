-- migrate:up

-- `effective_member_permission` is derived: a folder's own setting reduced by its parent's, which
-- is already reduced (#32). Until now only the fixtures wrote it, each walking the tree itself;
-- slice 7 lets an operator change a permission and move a folder, which moves the whole subtree's
-- values. Deriving it here rather than in a service means no writer can supply a wrong one, and
-- the reduction is written once.
--
-- `LEAST` *is* the rule: `forum_permission` is declared most-restrictive-first, so the enum's own
-- order is `hidden < read < write`, and `LEAST` ignores a null parent — which is the root.

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
