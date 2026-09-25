---
paths:
  - "backend/src/route/groups/**"
  - "backend/src/service/writing_*_service.ts"
  - "backend/src/service/writing_group_authorization.ts"
  - "backend/src/service/user_in_writing_group_service.ts"
  - "backend/src/service/folder_move.ts"
---

# Writing groups

## Who may change what is one table

`RULE` in `service/writing_group_authorization.ts`. A route names the act — `mayAct(role,
"page:change")` — rather than choosing between helpers:

- **`writer`**: any writer or administrator. Making something, and changing what the group *keeps* —
  folders, pages, ticking a step off.
- **`author`**: its author, or an administrator. Writing that *belongs* to somebody — a thread, a
  post, deleting a step.

The overloads carry the distinction: an `author` act cannot be asked without the content it is
about. A step splits on the operation: any writer ticks one, only its author deletes it.

**Demotion freezes what somebody already wrote.** The author rule asks whether the member may write
at all *before* asking whether the thing is theirs, so moving somebody to reader also stops them
changing or deleting their own threads, posts and steps. That is containment: demoting is the one
move a group can make against an account it believes compromised without waiting for an operator.
Pinned twice — over the helper and through the routes (`demotion_freezes_writing_test.ts`) — because
a route that forgot the helper would pass the first and fail the second.

## Reading and writing are guarded differently

A read goes through `visibleGroup`, over `selectVisibleWritingGroup`, which is what makes a public
group public. A write goes through `joinedGroup`, over `selectRoleForUser`, which only returns a role
for a *joined* membership — an invited administrator cannot administer until they accept. Drafts
depend on neither: `readableBy` keeps them with their author whoever asks.

`selectVisibleWritingGroup` is a lean gate and `selectWritingGroupForReader` the full read with the
favourite joined, on one base builder — most callers only ask yes or no.

## Memberships

`invited_at` and `joined_at` are set by the `set_membership_timestamps` trigger, never by a caller.
Joining is a *transition* — invited on Monday, accepted on Wednesday is an UPDATE — so the trigger
covers both. The interface shows whichever date matches the row's status.

## Drafts

A draft is a `writing_post` with `is_draft`, one per member per thread by partial unique index.

- **A draft moves no activity** — `set_last_activity_at_for_writing_thread` skips drafts, or every
  autosave would advance the thread and disclose who is typing.
- **A post is dated from publication.** Clearing `is_draft` sets `created_at` to `now()`; the
  draft's own start would sort a piece written over days into the middle of the thread.
- **`edited_at` stays null through autosaves and publication**, set only when a published post
  changes — the one case a reader is told about („· bearbeitet"). `updatePost` is handed the row's
  previous draft state to tell the three apart.
- `listPosts` returns published posts; `isDraft: true` returns the caller's own. The filter cannot
  widen visibility because `readableBy` still restricts drafts to their author.

## A group is a story, for now

`writing_group` carries the story's metadata. §20's data model puts it on a `Story` that a group
holds several of, and §43 schedules that for phase 2; until then the group is the story, and moving
the columns is a migration rather than a redesign. `story_idea` duplicates the same eleven columns —
#122. `story_status`, not `status`: the reader's membership status already has that name.

## Folders

`MAX_FOLDER_DEPTH` is checked against the subtree's *height* on a move, not the folder alone, and
`planFolderMove` in `folder_move.ts` is shared with the forum. Both `insertFolder` and `moveFolder`
lock the group's folders `FOR UPDATE` so a move cannot shift a parent between a read and an insert.
Only an empty folder may be deleted, and emptiness is a condition on the DELETE rather than a read
before it.
