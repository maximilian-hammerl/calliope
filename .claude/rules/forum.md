---
paths:
  - "backend/src/route/forum/**"
  - "backend/src/service/forum_*.ts"
  - "backend/src/service/folder_move.ts"
  - "backend/src/test/forum.ts"
  - "database/migrations/*forum*.sql"
  - "database/migrations/*folder_scope*.sql"
  - "database/test/forum_*.ts"
  - "database/test/folder_scope_test.ts"
  - "frontend/src/components/forum/**"
  - "frontend/src/components/folder/**"
  - "frontend/src/components/context/FolderRail*.vue"
  - "frontend/src/components/context/ForumRail.vue"
  - "frontend/src/views/Forum*.vue"
  - "frontend/src/lib/folder/**"
  - "frontend/src/lib/forum/**"
  - "frontend/src/lib/format/forum.ts"
  - "frontend/src/composables/useForumTree.ts"
  - "frontend/src/composables/useIsOperator.ts"
---

# The public forum (#32)

The forum is a writing group's tables with `writing_group_id IS NULL`. Threads, pages, posts and
folders are shared; **what differs is who may see and do what**, and that is `forum_permission.ts`
and `forum_authorization.ts` rather than membership.

## Permissions

Each folder, thread and page carries `member_permission` — `hidden < read < write`, the enum
declared most-restrictive-first so `LEAST` *is* the reduction. A folder's `effective_member_permission`
is **derived by the database** (`LEAST(own, parent's effective)`, cascading down on change); a
leaf's is computed on read from its own value and its folder's. Consequences:

- **A folder only ever narrows.** Nothing inside a `read` room can be `write`. A folder takes the
  most open permission anything in it needs, and the closed items carry their own.
- **A leaf with no folder gets `FORUM_ROOT_PERMISSION` (`read`)**: only operators create or write at
  the root. Folders are exempt, or `write` would be unreachable everywhere.
- **`hidden` answers 404, not 403** — "may not see" and "does not exist" are one answer — and hidden
  rows are filtered out of a member's lists entirely. An operator sees everything.
- A row keeps its **own** setting beside the effective one, so re-opening a folder restores what
  was set inside it. The edit dialog shows the own value; the marks show the effective one.

## Who may act

`RULE` in `forum_authorization.ts`, same shape as the group's: `write` acts ask the governing row
(creating in a folder, posting in a thread, editing a page), `author` acts ask the row *and* whether
the author may still write there (a thread's owner in a folder that closed can change nothing), and
`operator` acts — the folder structure, the permissions — are granted by no value a member holds.
An operator passes everything. Moving a leaf asks **two** questions: may they change it, and may
they create where it is going. Operators are `platform_role` moderators (`useIsOperator`).

## The scope is enforced by triggers, not foreign keys

A composite FK cannot say "both null, or both the same" (`MATCH SIMPLE` skips a null key, `MATCH
FULL` rejects a mixed one), so `folder_scope.sql`'s triggers assert that a folder's parent and a
leaf's folder share the row's `writing_group_id`. Every forum query still spells out
`writing_group_id IS NULL` — 15 places; a forgotten one is a cross-scope leak the tests, not the
types, would catch. Group services were already scoped by group id, which is why sharing the tables
cost them only `$narrowType` assertions.

## The frontend

One tree for both scopes: `FolderTree`/`FolderTreeNode` and the rail take a `TreeScope`
(`lib/folder/treeScope.ts`) — `{ kind: 'group', groupId }` or `{ kind: 'forum', isOperator }` — and
`planFolderMove` is shared on the backend for the same reason. A leaf row shows its title and its
marks, not its kind (that word is `sr-only`). `ForumPermissionMark` is a `PencilOff` for read-only,
shown to members *and* operators with a word for each side, and an `EyeOff` for hidden, operators
only — a negation stands without its opposite, which the `Eye` it replaced could not. A read-only
thread or page says so where its composer or „Seite bearbeiten" would be, `FORUM_READ_ONLY_NOTE`.
Operators edit a leaf's permission from its own page (`ForumPermissionDialog`) and a folder's from
`FolderDialog`, which warns how many threads and pages hiding it would hide (`countLeaves`).

## Fixture and tests

The seed's forum follows a member's draft of the real structure and exercises every case: a `read`
room of pages, a `read` leaf inside a `write` room („Abschiede", „Infos & Regeln"), a `read` folder
inside a `write` one, three levels, a hidden room with a page and a thread, one member-editable page
(„Linksammlung"), and two forum favourites. There is one forum, so its seeded rows are in **every**
list: a test asserting on titles scopes them, and `clearForum` sweeps by the id prefix, never by title.
