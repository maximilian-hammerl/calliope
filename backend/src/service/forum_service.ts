import type { ExpressionBuilder, NotNull } from "kysely";
import { db } from "@/src/database/client.ts";
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
>(row: Row): Omit<Row, "memberPermission" | "folderPermission"> & Permitted {
  const { memberPermission, folderPermission, ...rest } = row;
  return {
    ...rest,
    effectiveMemberPermission: effectiveMemberPermission(
      memberPermission,
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

function forumFolders(user: User) {
  return db
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
): Promise<ForumFolder | undefined> {
  const folder = await forumFolders(user)
    .where("writingFolder.id", "=", folderId)
    .executeTakeFirst();

  if (folder === undefined) {
    return undefined;
  }

  const { memberPermission: _own, ...rest } = folder;
  return rest;
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
  // left to reduce. The own setting is dropped: nothing reads it yet.
  return folders.map(({ memberPermission: _own, ...folder }) => folder);
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
