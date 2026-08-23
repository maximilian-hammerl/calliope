-- migrate:up

-- Roles on the account itself, for the site rather than for one group's content. Nothing to do
-- with user_in_writing_group_role: an administrator of a writing group administers that group
-- and has no standing anywhere else.
--
-- Administrator is a superset of moderator, the same relationship administrator and writer have
-- inside a group, so the two levels read the same way wherever they are checked.
CREATE TYPE public.platform_role AS ENUM ('moderator', 'administrator');

-- Nullable, and null is the ordinary member: a role is something an account is given, so the
-- absence of one is the resting state rather than a value that has to be spelled out.
--
-- A column rather than its own table because every request already loads this row to resolve
-- the session, so the role arrives with it and no authorisation check costs a second query.
-- One role per account is the constraint that buys that; relaxing it later is additive.
ALTER TABLE public.user
    ADD COLUMN platform_role public.platform_role;

-- Operators are a handful of accounts among all of them, so the index only carries those.
CREATE INDEX user_platform_role_idx ON public.user (platform_role) WHERE platform_role IS NOT NULL;

-- migrate:down

DROP INDEX public.user_platform_role_idx;

ALTER TABLE public.user
    DROP COLUMN platform_role;

DROP TYPE public.platform_role;
