import type { ExpressionBuilder, NotNull } from "kysely";
import { db, type Transaction } from "@/src/database/client.ts";
import type { DB, ForumPermission } from "@/src/database/schema.ts";
import type { User } from "@/src/service/user_service.ts";
import { withFavourite } from "@/src/query/favourite.ts";
import {
  listResultsWithCount,
  searchPattern,
} from "@/src/list/list_endpoint_query.ts";
import type { ListQuery, ListResults } from "@/src/list/list_endpoint_query.ts";
import {
  effectiveMemberPermission,
  isOperator,
} from "@/src/service/forum_permission.ts";
import { planFolderMove } from "@/src/service/folder_move.ts";
import { MAX_FOLDER_DEPTH } from "@/src/service/writing_folder_service.ts";
import type { PostDocument } from "@/src/document/document_schema.ts";
import { documentToPlainText } from "@/src/document/document_text.ts";
import { WritingPostService } from "@/src/service/writing_post_service.ts";
import type { Post } from "@/src/service/writing_post_service.ts";

/**
 * The public forum (#32): a writing group's tables scoped by `writing_group_id IS NULL`. Posts
 * need nothing here — `WritingPostService.listPosts` is scoped to a thread, never to a group.
 *
 * What is not shared is the authorisation: a group asks about membership, this asks the folder.
 * The rule is `forum_permission.ts`; this is where it meets a query.
 */

/** On every row: what the member who asked may do with it, already reduced. */
type Permitted = { effectiveMemberPermission: ForumPermission };

export type ForumFolder = Permitted & {
  id: string;
  /** The folder's own setting, which an operator's dialog shows; `Permitted` carries the reduced one. */
  memberPermission: ForumPermission;
  parentFolderId: string | null;
  depth: number;
  title: string;
  description: string | null;
  createdBy: string | null;
  createdByUsername: string | null;
  createdAt: string;
};

export type ForumThread = Permitted & {
  id: string;
  /** Its own setting, which an operator's dialog shows; `Permitted` carries the reduced one. */
  memberPermission: ForumPermission;
  folderId: string | null;
  title: string;
  createdBy: string | null;
  createdByUsername: string | null;
  createdAt: string;
  lastActivityAt: string;
  isFavourite: boolean;
};

export type ForumPageSummary = Permitted & {
  id: string;
  /** As a thread's: what was chosen here, which a folder above may still be reducing. */
  memberPermission: ForumPermission;
  folderId: string | null;
  title: string;
  createdBy: string | null;
  createdByUsername: string | null;
  createdAt: string;
  lastActivityAt: string;
  updatedBy: string | null;
  updatedByUsername: string | null;
  isFavourite: boolean;
};

export type ForumPage = ForumPageSummary & { document: PostDocument };

/**
 * What a reader is told about a leaf: its own setting against its folder's already-reduced one,
 * which is null at the root. Six reads answer with it, so the reduction is written once.
 */
function withEffectivePermission<
  Row extends {
    memberPermission: ForumPermission;
    folderPermission: ForumPermission | null;
  },
>(row: Row): Omit<Row, "folderPermission"> & Permitted {
  const { folderPermission, ...rest } = row;
  return {
    ...rest,
    effectiveMemberPermission: effectiveMemberPermission(
      rest.memberPermission,
      folderPermission,
    ),
  };
}

/**
 * A leaf is excluded by its own setting or by its folder's. The `IS NULL` arm is the root: a
 * comparison with null is null, so `<> 'hidden'` alone would drop those rows.
 */
function leafNotHidden(
  eb: ExpressionBuilder<DB, "writingThread" | "writingFolder">,
) {
  return eb.and([
    eb("writingThread.memberPermission", "<>", "hidden"),
    eb.or([
      eb("writingFolder.effectiveMemberPermission", "is", null),
      eb("writingFolder.effectiveMemberPermission", "<>", "hidden"),
    ]),
  ]);
}

function pageNotHidden(
  eb: ExpressionBuilder<DB, "writingPage" | "writingFolder">,
) {
  return eb.and([
    eb("writingPage.memberPermission", "<>", "hidden"),
    eb.or([
      eb("writingFolder.effectiveMemberPermission", "is", null),
      eb("writingFolder.effectiveMemberPermission", "<>", "hidden"),
    ]),
  ]);
}

function forumFolders(user: User, executor: typeof db | Transaction = db) {
  return executor
    .selectFrom("writingFolder")
    .leftJoin("user", "user.id", "writingFolder.createdBy")
    .select([
      "writingFolder.id",
      "writingFolder.parentFolderId",
      "writingFolder.depth",
      "writingFolder.title",
      "writingFolder.description",
      "writingFolder.createdBy",
      "writingFolder.createdAt",
      "writingFolder.memberPermission",
      "writingFolder.effectiveMemberPermission",
      "user.username as createdByUsername",
    ])
    .where("writingFolder.writingGroupId", "is", null)
    // Not null once the scope is the forum's; the table's CHECK is what makes that true.
    .$narrowType<
      { memberPermission: NotNull; effectiveMemberPermission: NotNull }
    >()
    .$if(
      !isOperator(user),
      (builder) =>
        builder.where(
          "writingFolder.effectiveMemberPermission",
          "<>",
          "hidden",
        ),
    );
}

/** The gate a create resolves its parent through, so a group's folder id cannot be borrowed. */
async function selectFolder(
  user: User,
  folderId: string,
  executor: typeof db | Transaction = db,
): Promise<ForumFolder | undefined> {
  const folder = await forumFolders(user, executor)
    .where("writingFolder.id", "=", folderId)
    .executeTakeFirst();

  if (folder === undefined) {
    return undefined;
  }

  return folder;
}

/**
 * Every folder of the forum in creation order, flat, exactly as a group's tree gets them.
 *
 * A folder stores its reduced value, so no path is walked here — that is what the denormalised
 * column is for.
 */
async function listFolders(user: User): Promise<ForumFolder[]> {
  const folders = await forumFolders(user)
    .orderBy("writingFolder.createdAt", "asc")
    // Folders made in one statement share a timestamp, and uuidv7 keeps those in the order they
    // were made. The group's tree orders its branches the same way.
    .orderBy("writingFolder.id", "asc")
    .execute();

  // The stored value is already the minimum over the path including this folder, so nothing is
  // left to reduce; both are sent, for the reason `FORUM_FOLDER_RESPONSE` gives.
  return folders;
}

function forumThreads(user: User) {
  return db
    .selectFrom("writingThread")
    .leftJoin("user", "user.id", "writingThread.createdBy")
    .leftJoin("writingFolder", "writingFolder.id", "writingThread.folderId")
    .select([
      "writingThread.id",
      "writingThread.folderId",
      "writingThread.title",
      "writingThread.createdBy",
      "writingThread.createdAt",
      "writingThread.lastActivityAt",
      "writingThread.memberPermission",
      "writingFolder.effectiveMemberPermission as folderPermission",
      "user.username as createdByUsername",
    ])
    .where("writingThread.writingGroupId", "is", null)
    .$narrowType<{ memberPermission: NotNull }>()
    .$if(!isOperator(user), (builder) => builder.where(leafNotHidden));
}

/** Threads of the forum, most recently written in first — the tree nests them by `folderId`. */
async function listThreads(user: User): Promise<ForumThread[]> {
  const threads = await forumThreads(user)
    .$call((builder) =>
      withFavourite(builder, "writing_thread", "writingThread.id", user.id)
    )
    .orderBy("writingThread.lastActivityAt", "desc")
    .orderBy("writingThread.id", "desc")
    .execute();

  return threads.map(withEffectivePermission);
}

/** One function rather than the group's gate-and-view pair: two callers, both wanting the favourite. */
async function selectThread(
  user: User,
  threadId: string,
): Promise<ForumThread | undefined> {
  const thread = await forumThreads(user)
    .$call((builder) =>
      withFavourite(builder, "writing_thread", "writingThread.id", user.id)
    )
    .where("writingThread.id", "=", threadId)
    .executeTakeFirst();

  if (thread === undefined) {
    return undefined;
  }

  return withEffectivePermission(thread);
}

function forumPages(user: User) {
  return db
    .selectFrom("writingPage")
    .leftJoin("user", "user.id", "writingPage.createdBy")
    .leftJoin("writingFolder", "writingFolder.id", "writingPage.folderId")
    .select((eb) => [
      "writingPage.id",
      "writingPage.folderId",
      "writingPage.title",
      "writingPage.createdBy",
      "writingPage.createdAt",
      "writingPage.lastActivityAt",
      "writingPage.updatedBy",
      "writingPage.memberPermission",
      "writingFolder.effectiveMemberPermission as folderPermission",
      "user.username as createdByUsername",
      // A subquery rather than a second alias on `user`, for the reason the group's page service
      // gives: another join widens the builder's table set, and this is a key lookup.
      eb.selectFrom("user as editor")
        .select("editor.username")
        .whereRef("editor.id", "=", "writingPage.updatedBy")
        .as("updatedByUsername"),
    ])
    .where("writingPage.writingGroupId", "is", null)
    .$narrowType<{ memberPermission: NotNull }>()
    .$if(!isOperator(user), (builder) => builder.where(pageNotHidden));
}

/** Pages of the forum — announcements, FAQs and rules — most recently written in first. */
async function listPages(user: User): Promise<ForumPageSummary[]> {
  const pages = await forumPages(user)
    .$call((builder) =>
      withFavourite(builder, "writing_page", "writingPage.id", user.id)
    )
    .orderBy("writingPage.lastActivityAt", "desc")
    .orderBy("writingPage.id", "desc")
    .execute();

  return pages.map(withEffectivePermission);
}

/** The page as its own view reads it, prose included, favourite included. */
async function selectPageForReader(
  user: User,
  pageId: string,
): Promise<ForumPage | undefined> {
  const page = await forumPages(user)
    .$call((builder) =>
      withFavourite(builder, "writing_page", "writingPage.id", user.id)
    )
    .select((eb) =>
      eb.ref("writingPage.document").$castTo<PostDocument>().as("document")
    )
    .where("writingPage.id", "=", pageId)
    .executeTakeFirst();

  if (page === undefined) {
    return undefined;
  }

  return withEffectivePermission(page);
}

/**
 * Threads of the forum a search may return. The counterpart of `WritingThreadService`'s, built on
 * the same builder the tree uses — so the scope, the hidden-path filter and the operator's wider
 * view are inherited rather than restated, and search cannot come to disagree with the tree about
 * what a member may see.
 *
 * The forum is one place, so there is no title to join and say which: the section a result appears
 * under is what tells the reader where it is.
 */
async function searchThreads(
  user: User,
  query: ListQuery,
): Promise<ListResults<ForumThread>> {
  const threads = forumThreads(user)
    .$call((builder) =>
      withFavourite(builder, "writing_thread", "writingThread.id", user.id)
    )
    .$if(
      query.search !== undefined,
      (builder) =>
        builder.where(
          "writingThread.title",
          "ilike",
          // deno-lint-ignore no-non-null-assertion -- the `$if` only runs this when it is set
          searchPattern(query.search!),
        ),
    );

  const found = await listResultsWithCount(threads, query);
  return { ...found, results: found.results.map(withEffectivePermission) };
}

/**
 * As the group's does, this matches the title *and* the prose through the `text` projection: the
 * row still carries only the title, like every other kind's.
 */
async function searchPages(
  user: User,
  query: ListQuery,
): Promise<ListResults<ForumPageSummary>> {
  const pages = forumPages(user)
    .$call((builder) =>
      withFavourite(builder, "writing_page", "writingPage.id", user.id)
    )
    .$if(query.search !== undefined, (builder) =>
      builder.where((eb) => {
        // deno-lint-ignore no-non-null-assertion -- the `$if` only runs this when it is set
        const term = searchPattern(query.search!);
        return eb.or([
          eb("writingPage.title", "ilike", term),
          eb("writingPage.text", "ilike", term),
        ]);
      }));

  const found = await listResultsWithCount(pages, query);
  return { ...found, results: found.results.map(withEffectivePermission) };
}

/**
 * The forum's structure, which is an operator's alone (#32's slice 7). The counterparts of
 * `WritingFolderService`'s four, without a group to scope them: `writing_group_id IS NULL` is the
 * scope, and it is written on every one of them.
 *
 * `effective_member_permission` is never supplied here — the database derives it, and a move or a
 * permission change carries the whole subtree with it. See `20260904100000_forum_effective_permission.sql`.
 */
export type CreateFolderOutcome =
  | { kind: "created"; folder: ForumFolder }
  | { kind: "noSuchParent" }
  | { kind: "tooDeep" };

async function insertFolder(
  user: User,
  values: {
    title: string;
    description: string | null;
    parentFolderId: string | null;
    memberPermission: ForumPermission;
  },
): Promise<CreateFolderOutcome> {
  return await db.transaction().execute(async (transaction) => {
    let depth = 1;
    if (values.parentFolderId !== null) {
      // Locked, and in the same transaction, for the reason the group's insert gives: a move
      // could otherwise shift this parent deeper between the read and the insert.
      const parent = await transaction
        .selectFrom("writingFolder")
        .select("depth")
        .where("writingGroupId", "is", null)
        .where("id", "=", values.parentFolderId)
        .forUpdate()
        .executeTakeFirst();

      if (parent === undefined) {
        return { kind: "noSuchParent" } as const;
      }
      if (parent.depth >= MAX_FOLDER_DEPTH) {
        return { kind: "tooDeep" } as const;
      }
      depth = parent.depth + 1;
    }

    const { id } = await transaction
      .insertInto("writingFolder")
      .values({ writingGroupId: null, ...values, depth, createdBy: user.id })
      .returning(["id"])
      .executeTakeFirstOrThrow();

    const folder = await selectFolder(user, id, transaction);
    if (folder === undefined) {
      throw new Error(`Folder ${id} was written and could not be read back`);
    }
    return { kind: "created", folder } as const;
  });
}

/** Title and description only: where a folder sits is `moveFolder`, and its permission is its own. */
async function updateFolder(
  user: User,
  folderId: string,
  values: { title: string; description: string | null },
): Promise<ForumFolder | undefined> {
  const updated = await db
    .updateTable("writingFolder")
    .set(values)
    .where("writingGroupId", "is", null)
    .where("id", "=", folderId)
    .returning("id")
    .executeTakeFirst();

  return updated === undefined ? undefined : await selectFolder(user, folderId);
}

async function moveFolder(
  user: User,
  folderId: string,
  parentFolderId: string | null,
): Promise<MoveFolderOutcome | undefined> {
  const outcome = await db.transaction().execute(async (transaction) => {
    const rows = await transaction
      .selectFrom("writingFolder")
      .select(["id", "parentFolderId", "depth"])
      .where("writingGroupId", "is", null)
      .forUpdate()
      .execute();

    const plan = planFolderMove(rows, folderId, parentFolderId);
    if (plan === undefined || plan.kind !== "plan") {
      return plan;
    }

    // The parent first and on its own, so the trigger that derives the subtree's permissions sees
    // the new path; the depth shift after it changes no permission.
    await transaction
      .updateTable("writingFolder")
      .set({ parentFolderId })
      .where("id", "=", folderId)
      .execute();

    if (plan.delta !== 0) {
      await transaction
        .updateTable("writingFolder")
        .set((eb) => ({ depth: eb("depth", "+", plan.delta) }))
        .where("id", "in", plan.subtree)
        .execute();
    }

    return { kind: "moved" } as const;
  });

  if (outcome === undefined || outcome.kind !== "moved") {
    return outcome;
  }

  const folder = await selectFolder(user, folderId);
  if (folder === undefined) {
    throw new Error(
      `Folder ${folderId} could not be read back after moving it`,
    );
  }
  return { kind: "moved", folder };
}

export type MoveFolderOutcome =
  | { kind: "moved"; folder: ForumFolder }
  | { kind: "noSuchParent" }
  | { kind: "cycle" }
  | { kind: "tooDeep" };

export type DeleteFolderOutcome = "deleted" | "notEmpty" | "notFound";

/**
 * Only an empty folder goes, as a group's does: deleting a subtree is unrecoverable with no edit
 * history behind it. Emptiness is a condition on the delete rather than a read before it, so
 * nothing can be added in between.
 */
async function deleteFolder(folderId: string): Promise<DeleteFolderOutcome> {
  const { numDeletedRows } = await db
    .deleteFrom("writingFolder")
    .where("writingGroupId", "is", null)
    .where("id", "=", folderId)
    .where((eb) =>
      eb.not(eb.exists(
        eb.selectFrom("writingFolder as child")
          .select("child.id")
          .whereRef("child.parentFolderId", "=", "writingFolder.id"),
      ))
    )
    .where((eb) =>
      eb.not(eb.exists(
        eb.selectFrom("writingPage")
          .select("writingPage.id")
          .whereRef("writingPage.folderId", "=", "writingFolder.id"),
      ))
    )
    .where((eb) =>
      eb.not(eb.exists(
        eb.selectFrom("writingThread")
          .select("writingThread.id")
          .whereRef("writingThread.folderId", "=", "writingFolder.id"),
      ))
    )
    .executeTakeFirst();

  if (numDeletedRows > 0n) {
    return "deleted";
  }

  // Nothing went, so say which: gone already, or still holding something.
  const exists = await db
    .selectFrom("writingFolder")
    .select("id")
    .where("writingGroupId", "is", null)
    .where("id", "=", folderId)
    .executeTakeFirst();

  return exists === undefined ? "notFound" : "notEmpty";
}

/**
 * The three kinds that carry a permission, and the table each one is. One route sets all three
 * (#32's slice 7) for the reason one pair sets a favourite over five: the act is identical
 * whatever it names, and three routes saying the same thing would reach the client as three hooks.
 */
export const FORUM_PERMISSION_TARGET_TYPES = [
  "folder",
  "thread",
  "page",
] as const;

export type ForumPermissionTargetType =
  typeof FORUM_PERMISSION_TARGET_TYPES[number];

const PERMISSION_TABLE = {
  folder: "writingFolder",
  thread: "writingThread",
  page: "writingPage",
} as const satisfies Record<ForumPermissionTargetType, keyof DB>;

/**
 * What members may do with one row. A folder's takes its whole subtree with it, which the database
 * does rather than this — see the trigger migration.
 *
 * `member_permission` is the row's *own* setting, never the reduced one: a folder above it can
 * still close it, and re-opening that folder restores what was set here.
 */
async function setPermission(
  targetType: ForumPermissionTargetType,
  targetId: string,
  memberPermission: ForumPermission,
): Promise<"set" | "notFound"> {
  const updated = await db
    .updateTable(PERMISSION_TABLE[targetType])
    .set({ memberPermission })
    .where("writingGroupId", "is", null)
    .where("id", "=", targetId)
    .returning("id")
    .executeTakeFirst();

  return updated === undefined ? "notFound" : "set";
}

/**
 * Where a leaf sits. The scope needs no checking beyond `writing_group_id IS NULL` here: a folder
 * of a writing group is refused by the trigger in `20260903140000_folder_scope.sql`, and the route
 * has already resolved the target through `selectFolder`, which is the forum's own.
 */
async function moveThread(
  user: User,
  threadId: string,
  folderId: string | null,
): Promise<ForumThread | undefined> {
  const moved = await db
    .updateTable("writingThread")
    .set({ folderId })
    .where("writingGroupId", "is", null)
    .where("id", "=", threadId)
    .returning("id")
    .executeTakeFirst();

  return moved === undefined ? undefined : await selectThread(user, threadId);
}

async function movePage(
  user: User,
  pageId: string,
  folderId: string | null,
): Promise<ForumPageSummary | undefined> {
  const moved = await db
    .updateTable("writingPage")
    .set({ folderId })
    .where("writingGroupId", "is", null)
    .where("id", "=", pageId)
    .returning("id")
    .executeTakeFirst();

  return moved === undefined
    ? undefined
    : await selectPageForReader(user, pageId);
}

/**
 * The forum's writes: the group's inserts without the group, and without its activity
 * notification — who hears about a forum post is #119.
 *
 * `member_permission` is `write` on everything new, which restricts nothing. Whether a member may
 * create at all is the folder's answer, checked by the route.
 */
async function insertThread(
  user: User,
  title: string,
  folderId: string | null = null,
): Promise<ForumThread> {
  const { id } = await db
    .insertInto("writingThread")
    .values({
      writingGroupId: null,
      folderId,
      title,
      createdBy: user.id,
      memberPermission: "write",
    })
    .returning(["id"])
    .executeTakeFirstOrThrow();

  // The whole user, not their id: a stand-in would read as an operator, since an absent
  // `platformRole` is `undefined` rather than null.
  const thread = await selectThread(user, id);
  if (thread === undefined) {
    throw new Error(`Thread ${id} was written and could not be read back`);
  }
  return thread;
}

/**
 * `text` is derived here rather than accepted, so it cannot disagree with the document. Read back
 * through `WritingPostService.selectPost`, which is scoped to the thread and not to a group.
 */
async function insertPost(
  threadId: string,
  document: PostDocument,
  isDraft: boolean,
  createdBy: string,
): Promise<Post> {
  const { id } = await db
    .insertInto("writingPost")
    .values({
      writingThreadId: threadId,
      // An object, not a string: `JSON.stringify` here would store a jsonb *string*.
      document,
      text: documentToPlainText(document),
      isDraft,
      createdBy,
    })
    .returning(["id"])
    .executeTakeFirstOrThrow();

  const post = await WritingPostService.selectPost(threadId, id, createdBy);
  if (post === undefined) {
    throw new Error(`Post ${id} was written and could not be read back`);
  }
  return post;
}

async function insertPage(
  user: User,
  title: string,
  document: PostDocument,
  folderId: string | null = null,
): Promise<ForumPage> {
  const { id } = await db
    .insertInto("writingPage")
    .values({
      writingGroupId: null,
      folderId,
      title,
      document,
      text: documentToPlainText(document),
      createdBy: user.id,
      // The author counts as the first editor, as the group's service has it, so a stale save can
      // name somebody from the start.
      updatedBy: user.id,
      memberPermission: "write",
    })
    .returning(["id"])
    .executeTakeFirstOrThrow();

  const page = await selectPageForReader(user, id);
  if (page === undefined) {
    throw new Error(`Page ${id} was written and could not be read back`);
  }
  return page;
}

/** The page either way: on „stale" it is who saved first, which the refusal names. */
export type UpdateOutcome =
  | { kind: "updated"; page: ForumPage }
  | { kind: "stale"; page: ForumPage };

/**
 * A page is one body changed in place, so two editors race: the write is conditional on the
 * `last_activity_at` the client loaded, as the group's is.
 */
async function updatePage(
  user: User,
  pageId: string,
  loadedAt: string,
  values: { title: string; document: PostDocument },
): Promise<UpdateOutcome | undefined> {
  const written = await db
    .updateTable("writingPage")
    .set({
      title: values.title,
      document: values.document,
      text: documentToPlainText(values.document),
      updatedBy: user.id,
    })
    .where("id", "=", pageId)
    .where("writingGroupId", "is", null)
    .where("lastActivityAt", "=", loadedAt)
    .returning(["id"])
    .executeTakeFirst();

  // Re-read either way: on a stale write it is the *other* editor's name the refusal needs.
  const page = await selectPageForReader(user, pageId);
  if (page === undefined) {
    return undefined;
  }

  return { kind: written === undefined ? "stale" : "updated", page };
}

export const ForumService = {
  listFolders,
  selectFolder,
  insertFolder,
  updateFolder,
  moveFolder,
  deleteFolder,
  setPermission,
  moveThread,
  movePage,
  listThreads,
  selectThread,
  listPages,
  selectPageForReader,
  searchThreads,
  searchPages,
  insertThread,
  insertPost,
  insertPage,
  updatePage,
};
