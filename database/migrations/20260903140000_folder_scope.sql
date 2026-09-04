-- migrate:up

-- Everything in the tree must sit in its own scope (#32): a folder under a folder, and a thread or
-- a page in a folder. Otherwise a forum row could hang off a group's folder, where it reads as
-- being at the root — a group folder's `effective_member_permission` is null, which is what the
-- forum's queries take to mean "no folder above this".
--
-- Not composite foreign keys: a forum row's scope *is* null, which MATCH SIMPLE skips and MATCH
-- FULL rejects. A CHECK cannot reach another table either, so it is triggers.

CREATE FUNCTION public.assert_folder_parent_shares_scope()
    RETURNS TRIGGER
    set search_path to ''
AS
$$
DECLARE
    parent_writing_group_id UUID;
BEGIN
    SELECT writing_group_id
    INTO parent_writing_group_id
    FROM public.writing_folder
    WHERE id = NEW.parent_folder_id;

    -- `IS DISTINCT FROM`, not `<>`: both are null in the forum, where `<>` answers null.
    IF parent_writing_group_id IS DISTINCT FROM NEW.writing_group_id THEN
        RAISE EXCEPTION
            'Folder % is in writing group % but its parent % is in writing group %',
            NEW.id, NEW.writing_group_id, NEW.parent_folder_id, parent_writing_group_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Scoped to the two columns that can break it, and skipped at the root, which has no parent.
CREATE TRIGGER assert_parent_shares_scope
    BEFORE INSERT OR UPDATE OF parent_folder_id, writing_group_id
    ON public.writing_folder
    FOR EACH ROW
    WHEN (NEW.parent_folder_id IS NOT NULL)
EXECUTE FUNCTION public.assert_folder_parent_shares_scope();

-- One function for both leaf tables, which name these columns identically; `TG_TABLE_NAME` is what
-- lets the message say which one it was.
CREATE FUNCTION public.assert_leaf_shares_folder_scope()
    RETURNS TRIGGER
    set search_path to ''
AS
$$
DECLARE
    folder_writing_group_id UUID;
BEGIN
    SELECT writing_group_id
    INTO folder_writing_group_id
    FROM public.writing_folder
    WHERE id = NEW.folder_id;

    IF folder_writing_group_id IS DISTINCT FROM NEW.writing_group_id THEN
        RAISE EXCEPTION
            '% % is in writing group % but its folder % is in writing group %',
            TG_TABLE_NAME, NEW.id, NEW.writing_group_id,
            NEW.folder_id, folder_writing_group_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER assert_folder_shares_scope
    BEFORE INSERT OR UPDATE OF folder_id, writing_group_id
    ON public.writing_thread
    FOR EACH ROW
    WHEN (NEW.folder_id IS NOT NULL)
EXECUTE FUNCTION public.assert_leaf_shares_folder_scope();

CREATE TRIGGER assert_folder_shares_scope
    BEFORE INSERT OR UPDATE OF folder_id, writing_group_id
    ON public.writing_page
    FOR EACH ROW
    WHEN (NEW.folder_id IS NOT NULL)
EXECUTE FUNCTION public.assert_leaf_shares_folder_scope();

-- migrate:down

DROP TRIGGER assert_folder_shares_scope ON public.writing_page;
DROP TRIGGER assert_folder_shares_scope ON public.writing_thread;
DROP FUNCTION public.assert_leaf_shares_folder_scope();

DROP TRIGGER assert_parent_shares_scope ON public.writing_folder;
DROP FUNCTION public.assert_folder_parent_shares_scope();
