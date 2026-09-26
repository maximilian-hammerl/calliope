import { assert, assertEquals } from "@std/assert";
import sharp from "sharp";
import openApi from "@/open-api.json" with { type: "json" };
import app from "@/src/app.ts";
import { db } from "@/src/database/client.ts";
import type { ForumPermission } from "@/src/database/schema.ts";
import {
  addMember,
  clearRateLimits,
  createGroup,
  deleteUsers,
  getUserId,
  registerUser,
  request,
  SAME_ORIGIN,
  write,
} from "@/src/test/support.ts";
import { clearForum } from "@/src/test/forum.ts";
import {
  address,
  answer,
  createdOk,
  forumWithChildren,
  groupWithChildren,
  type Ids,
  missingId,
  REQUEST_BODIES,
} from "@/src/test/route_fixtures.ts";
import { fileReportOk, makeOperator } from "@/src/test/reports.ts";
import { createIdea, patchIdea } from "@/src/test/story_ideas.ts";
import { blockMember } from "@/src/test/blocks.ts";
import { assertUnreachable } from "@/src/util/assert_unreachable.ts";

/**
 * For every route with an id in its path: what a member with no part in the rows gets at each
 * visibility, and, where they cannot see the rows, the same answer as for ids nobody has.
 */

const OWNER = "stranger-access-owner";
const MEMBER = "stranger-access-member";
const STRANGER = "stranger-access-stranger";
const OPERATOR = "stranger-access-operator";
const USERNAMES = [OWNER, MEMBER, STRANGER, OPERATOR];

Deno.test.beforeEach(clearRateLimits);
Deno.test.afterEach(async () => {
  await clearForum(USERNAMES);
  // Neither goes with its creator — both keep their rows with the account nulled.
  const ours = db.selectFrom("user").select("id").where(
    "username",
    "in",
    USERNAMES,
  );
  await write((transaction) =>
    transaction.deleteFrom("report").where("reporterId", "in", ours).execute()
  );
  await write((transaction) =>
    transaction.deleteFrom("chatGroup").where("createdBy", "in", ours)
      .execute()
  );
  await deleteUsers(USERNAMES);
});

/** The rows a route is tried on — another member's, in each state that changes the answer. */
type Key =
  | "private"
  | "public"
  | "hidden"
  | "read"
  | "write"
  | "chat"
  | "open idea"
  | "closed idea"
  | "member"
  | "blocked member"
  | "session"
  | "avatar"
  | "report";

/** Which rows each part of the API is tried on. */
const SCOPES: ReadonlyArray<{ prefix: string; keys: readonly Key[] }> = [
  { prefix: "/api/groups/{", keys: ["private", "public"] },
  { prefix: "/api/forum/", keys: ["hidden", "read", "write"] },
  { prefix: "/api/chats/{", keys: ["chat"] },
  { prefix: "/api/story-ideas/{", keys: ["open idea", "closed idea"] },
  {
    prefix: "/api/favourites/",
    keys: ["private", "public", "hidden", "read", "write", "chat", "open idea"],
  },
  { prefix: "/api/users/{", keys: ["member"] },
  { prefix: "/api/blocks/{", keys: ["blocked member"] },
  { prefix: "/api/auth/sessions/{", keys: ["session"] },
  { prefix: "/api/avatars/{", keys: ["avatar"] },
  { prefix: "/api/reports/{", keys: ["report"] },
];

/** Rows the stranger may not even see: then their answer must match a missing id's. */
const UNSEEN: ReadonlySet<Key> = new Set([
  "private",
  "hidden",
  "chat",
  "session",
  "report",
]);

type Tree = {
  key: Key;
  /** Who may do everything here, and so proves the request well-formed. */
  controller: "owner" | "operator";
  ids: Record<string, string>;
  /** How `favourites/{targetType}/{targetId}` names these rows. */
  favourite?: { targetType: string; targetId: string };
};

type Fixture = {
  ownerCookie: string;
  strangerCookie: string;
  strangerId: string;
  operatorCookie: string;
  trees: Tree[];
};

type Case = {
  /** Only where the body depends on the tree; otherwise `REQUEST_BODIES` has it. */
  body?: (target: Tree) => unknown;
  /** Path ids the case names rather than the tree — a kind, and the row of that kind. */
  params?: (target: Tree) => Record<string, string>;
  /** What the stranger gets, per tree. */
  stranger: Partial<Record<Key, number>>;
  /** What the tree's controller gets: success unless a tree says otherwise, and why. */
  control?: Partial<Record<Key, number>>;
};

const CASES: Record<string, Case> = {
  "GET /api/groups/{groupId}": { stranger: { private: 404, public: 200 } },
  "PATCH /api/groups/{groupId}": {
    stranger: { private: 404, public: 403 },
  },
  // Asking a public group's administrators is what a stranger may do; its owner is already in it.
  "POST /api/groups/{groupId}/conversations": {
    stranger: { private: 404, public: 201 },
    control: { private: 403, public: 403 },
  },
  "POST /api/groups/{groupId}/folders": {
    stranger: { private: 404, public: 404 },
  },
  "GET /api/groups/{groupId}/folders": {
    stranger: { private: 404, public: 200 },
  },
  "PUT /api/groups/{groupId}/folders/{folderId}": {
    stranger: { private: 404, public: 404 },
  },
  "DELETE /api/groups/{groupId}/folders/{folderId}": {
    stranger: { private: 404, public: 404 },
  },
  "PUT /api/groups/{groupId}/folders/{folderId}/parent": {
    stranger: { private: 404, public: 404 },
  },
  "POST /api/groups/{groupId}/memberships": {
    stranger: { private: 404, public: 403 },
  },
  "GET /api/groups/{groupId}/memberships": {
    stranger: { private: 404, public: 200 },
  },
  // The stranger has no invitation to accept, and the owner's membership is joined already.
  "POST /api/groups/{groupId}/memberships/me/accept": {
    stranger: { private: 404, public: 404 },
    control: { private: 409, public: 409 },
  },
  "PATCH /api/groups/{groupId}/memberships/{userId}": {
    stranger: { private: 404, public: 403 },
  },
  "DELETE /api/groups/{groupId}/memberships/{userId}": {
    stranger: { private: 404, public: 403 },
  },
  "POST /api/groups/{groupId}/pages": {
    stranger: { private: 404, public: 404 },
  },
  "GET /api/groups/{groupId}/pages": {
    stranger: { private: 404, public: 200 },
  },
  "GET /api/groups/{groupId}/pages/{pageId}": {
    stranger: { private: 404, public: 200 },
  },
  "PUT /api/groups/{groupId}/pages/{pageId}": {
    stranger: { private: 404, public: 404 },
  },
  "DELETE /api/groups/{groupId}/pages/{pageId}": {
    stranger: { private: 404, public: 404 },
  },
  "PUT /api/groups/{groupId}/pages/{pageId}/folder": {
    stranger: { private: 404, public: 404 },
  },
  "POST /api/groups/{groupId}/steps": {
    stranger: { private: 404, public: 404 },
  },
  "GET /api/groups/{groupId}/steps": {
    stranger: { private: 404, public: 200 },
  },
  "PATCH /api/groups/{groupId}/steps/{stepId}": {
    stranger: { private: 404, public: 404 },
  },
  "DELETE /api/groups/{groupId}/steps/{stepId}": {
    stranger: { private: 404, public: 404 },
  },
  "POST /api/groups/{groupId}/threads": {
    stranger: { private: 404, public: 404 },
  },
  "GET /api/groups/{groupId}/threads": {
    stranger: { private: 404, public: 200 },
  },
  "GET /api/groups/{groupId}/threads/{threadId}": {
    stranger: { private: 404, public: 200 },
  },
  "PATCH /api/groups/{groupId}/threads/{threadId}": {
    stranger: { private: 404, public: 404 },
  },
  "DELETE /api/groups/{groupId}/threads/{threadId}": {
    stranger: { private: 404, public: 404 },
  },
  "POST /api/groups/{groupId}/threads/{threadId}/posts": {
    stranger: { private: 404, public: 404 },
  },
  "QUERY /api/groups/{groupId}/threads/{threadId}/posts": {
    stranger: { private: 404, public: 200 },
  },
  "GET /api/groups/{groupId}/threads/{threadId}/posts/{postId}": {
    stranger: { private: 404, public: 200 },
  },
  "PATCH /api/groups/{groupId}/threads/{threadId}/posts/{postId}": {
    stranger: { private: 404, public: 404 },
  },
  "DELETE /api/groups/{groupId}/threads/{threadId}/posts/{postId}": {
    stranger: { private: 404, public: 404 },
  },
  "PUT /api/groups/{groupId}/threads/{threadId}/folder": {
    stranger: { private: 404, public: 404 },
  },
  "PUT /api/forum/folders/{folderId}": {
    stranger: { hidden: 404, read: 403, write: 403 },
  },
  "DELETE /api/forum/folders/{folderId}": {
    stranger: { hidden: 404, read: 403, write: 403 },
  },
  "PUT /api/forum/folders/{folderId}/parent": {
    stranger: { hidden: 404, read: 403, write: 403 },
  },
  // Refused before anything is looked up, so hidden rows and missing ones get the same 403.
  "PUT /api/forum/permissions/{targetType}/{targetId}": {
    params: (target) => ({
      targetType: "thread",
      targetId: target.ids.threadId ?? "",
    }),
    body: (target) => ({ memberPermission: target.key }),
    stranger: { hidden: 403, read: 403, write: 403 },
  },
  "GET /api/forum/threads/{threadId}": {
    stranger: { hidden: 404, read: 200, write: 200 },
  },
  "PUT /api/forum/threads/{threadId}/folder": {
    stranger: { hidden: 404, read: 403, write: 403 },
  },
  "QUERY /api/forum/threads/{threadId}/posts": {
    stranger: { hidden: 404, read: 200, write: 200 },
  },
  // Replying where members may write is what the forum is for.
  "POST /api/forum/threads/{threadId}/posts": {
    stranger: { hidden: 404, read: 403, write: 201 },
  },
  "PATCH /api/forum/threads/{threadId}/posts/{postId}": {
    stranger: { hidden: 404, read: 403, write: 403 },
  },
  "DELETE /api/forum/threads/{threadId}/posts/{postId}": {
    stranger: { hidden: 404, read: 403, write: 403 },
  },
  "GET /api/forum/pages/{pageId}": {
    stranger: { hidden: 404, read: 200, write: 200 },
  },
  // A page members may write is one anybody may edit, as „Linksammlung" in the seed is.
  "PUT /api/forum/pages/{pageId}": {
    stranger: { hidden: 404, read: 403, write: 200 },
  },
  "PUT /api/forum/pages/{pageId}/folder": {
    stranger: { hidden: 404, read: 403, write: 403 },
  },
  "POST /api/chats/{chatId}/memberships": {
    stranger: { chat: 404 },
  },
  "QUERY /api/chats/{chatId}/memberships": {
    stranger: { chat: 404 },
  },
  // The owner started the chat, so has no invitation to accept.
  "POST /api/chats/{chatId}/memberships/me/accept": {
    stranger: { chat: 404 },
    control: { chat: 404 },
  },
  "DELETE /api/chats/{chatId}/memberships/me": { stranger: { chat: 404 } },
  "QUERY /api/chats/{chatId}/messages": {
    stranger: { chat: 404 },
  },
  "POST /api/chats/{chatId}/messages": {
    stranger: { chat: 404 },
  },
  "POST /api/chats/{chatId}/read": { stranger: { chat: 404 } },
  "GET /api/story-ideas/{ideaId}": {
    stranger: { "open idea": 200, "closed idea": 200 },
  },
  "PATCH /api/story-ideas/{ideaId}": {
    stranger: { "open idea": 403, "closed idea": 403 },
  },
  "DELETE /api/story-ideas/{ideaId}": {
    stranger: { "open idea": 403, "closed idea": 403 },
  },
  // Asking an open idea's author is what the board is for; an author has nobody to ask.
  "POST /api/story-ideas/{ideaId}/conversations": {
    stranger: { "open idea": 201, "closed idea": 403 },
    control: { "open idea": 403, "closed idea": 403 },
  },
  // The reader's own mark on somebody else's idea. An author is refused: discovery never lists
  // their own idea back to them, so the mark would never be shown.
  "PUT /api/story-ideas/{ideaId}/read": {
    stranger: { "open idea": 200, "closed idea": 200 },
    control: { "open idea": 403, "closed idea": 403 },
  },
  "DELETE /api/story-ideas/{ideaId}/read": {
    stranger: { "open idea": 200, "closed idea": 200 },
  },
  "PUT /api/favourites/{targetType}/{targetId}": {
    params: (target) => target.favourite ?? {},
    stranger: {
      private: 404,
      public: 200,
      hidden: 404,
      read: 200,
      write: 200,
      chat: 404,
      "open idea": 200,
    },
  },
  // Removing a mark the stranger never set changes nothing, so it succeeds whatever the target.
  "DELETE /api/favourites/{targetType}/{targetId}": {
    params: (target) => target.favourite ?? {},
    stranger: {
      private: 200,
      public: 200,
      hidden: 200,
      read: 200,
      write: 200,
      chat: 200,
      "open idea": 200,
    },
  },
  "GET /api/users/{userId}": { stranger: { member: 200 } },
  "POST /api/users/{userId}/ban": {
    stranger: { member: 403 },
  },
  // The member is not banned, so an operator finds nothing to lift.
  "DELETE /api/users/{userId}/ban": {
    stranger: { member: 403 },
    control: { member: 404 },
  },
  "DELETE /api/blocks/{userId}": { stranger: { "blocked member": 404 } },
  "DELETE /api/auth/sessions/{sessionId}": { stranger: { session: 404 } },
  "GET /api/avatars/{fileId}": { stranger: { avatar: 200 } },
  "PATCH /api/reports/{reportId}": {
    stranger: { report: 403 },
  },
};

type Operation = {
  operation: string;
  method: string;
  path: string;
  keys: readonly Key[] | undefined;
  bodyRequired: boolean;
};

/** Every operation with an id in its path, and the rows its part of the API is tried on. */
function operations(): Operation[] {
  const found: Operation[] = [];
  for (const [path, item] of Object.entries(openApi.paths)) {
    if (!path.includes("{")) {
      continue;
    }
    const keys = SCOPES.find(({ prefix }) => path.startsWith(prefix))?.keys;
    for (const [method, definition] of Object.entries(item)) {
      const upper = method.toUpperCase();
      const bodyRequired =
        (definition as { requestBody?: { required?: boolean } }).requestBody
          ?.required === true;
      found.push({
        operation: `${upper} ${path}`,
        method: upper,
        path,
        keys,
        bodyRequired,
      });
    }
  }
  return found;
}

type People = {
  ownerCookie: string;
  ownerId: string;
  memberCookie: string;
  memberId: string;
};

/** A group of the owner's with one of everything, and the member joined to it. */
async function groupTree(
  people: People,
  key: "private" | "public",
): Promise<Tree> {
  const ids = await groupWithChildren(people.ownerCookie, "Fremde Gruppe", key);
  const memberships = `/api/groups/${ids.groupId}/memberships`;
  await createdOk(people.ownerCookie, memberships, {
    userId: people.memberId,
    role: "writer",
  });
  await createdOk(
    people.memberCookie,
    `${memberships}/me/accept`,
    undefined,
    200,
  );

  return {
    key,
    controller: "owner",
    ids: { ...ids, userId: people.memberId },
    favourite: { targetType: "writing_thread", targetId: ids.threadId ?? "" },
  };
}

async function forumTree(
  key: ForumPermission,
  people: People,
): Promise<Tree> {
  const ids = await forumWithChildren(`Thema (${key})`, key, people.ownerId);
  return {
    key,
    controller: "operator",
    ids,
    favourite: { targetType: "writing_thread", targetId: ids.threadId ?? "" },
  };
}

/** The owner's conversation with the member, a message in it. */
async function chatTree(people: People): Promise<Tree> {
  const chat = await createdOk(people.ownerCookie, "/api/chats", {
    title: "Unter uns",
  });
  const base = `/api/chats/${chat.id}`;
  await createdOk(people.ownerCookie, `${base}/memberships`, {
    userId: people.memberId,
  });
  await createdOk(
    people.memberCookie,
    `${base}/memberships/me/accept`,
    undefined,
    200,
  );
  await createdOk(people.ownerCookie, `${base}/messages`, { text: "Hallo" });

  return {
    key: "chat",
    controller: "owner",
    ids: { chatId: chat.id },
    favourite: { targetType: "chat_group", targetId: chat.id },
  };
}

async function ideaTree(
  people: People,
  key: "open idea" | "closed idea",
): Promise<Tree> {
  const response = await createIdea(people.ownerCookie);
  assertEquals(response.status, 201);
  const idea = await response.json();
  if (key === "closed idea") {
    const closed = await patchIdea(people.ownerCookie, idea.id, {
      status: "closed",
    });
    assertEquals(closed.status, 200);
  }

  return {
    key,
    controller: "owner",
    ids: { ideaId: idea.id },
    favourite: { targetType: "story_idea", targetId: idea.id },
  };
}

/** A second session of the owner's, so revoking it leaves the one the control signs in with. */
async function sessionTree(people: People): Promise<Tree> {
  await createdOk(
    "",
    "/api/auth/login",
    { login: OWNER, password: "a-complex-password" },
    200,
  );
  const listed = await request("GET", "/api/auth/sessions", people.ownerCookie);
  const { results } = await listed.json();
  const other = results.find((session: { current: boolean }) =>
    !session.current
  );
  assert(other !== undefined, "the owner has a second session");

  return { key: "session", controller: "owner", ids: { sessionId: other.id } };
}

async function avatarTree(people: People): Promise<Tree> {
  const image = await sharp({
    create: { width: 64, height: 64, channels: 3, background: "#8a6a3a" },
  }).png().toBuffer();
  const form = new FormData();
  form.append(
    "image",
    new File([new Uint8Array(image)], "a.png", { type: "image/png" }),
  );
  form.append("origin", "own_work");
  form.append("confirmed", "true");
  const response = await app.request("/api/users/me/avatar", {
    method: "PUT",
    headers: { cookie: people.ownerCookie, ...SAME_ORIGIN },
    body: form,
  });
  assertEquals(response.status, 200);
  const { avatarUrl } = await response.json();

  return {
    key: "avatar",
    controller: "owner",
    ids: { fileId: String(avatarUrl).split("/").at(-1) ?? "" },
  };
}

/** The owner's report about the member — open, so an operator can take it. */
async function reportTree(people: People): Promise<Tree> {
  await fileReportOk(people.ownerCookie, "user", people.memberId);
  const report = await db
    .selectFrom("report")
    .select("id")
    .where("reporterId", "=", people.ownerId)
    .where("reportedUserId", "=", people.memberId)
    .executeTakeFirstOrThrow();

  return {
    key: "report",
    controller: "operator",
    ids: { reportId: report.id },
  };
}

async function tree(key: Key, people: People): Promise<Tree> {
  switch (key) {
    case "private":
    case "public":
      return await groupTree(people, key);
    case "hidden":
    case "read":
    case "write":
      return await forumTree(key, people);
    case "chat":
      return await chatTree(people);
    case "open idea":
    case "closed idea":
      return await ideaTree(people, key);
    case "member":
      return {
        key,
        controller: "operator",
        ids: { userId: people.memberId },
      };
    case "blocked member": {
      const blocked = await blockMember(people.ownerCookie, people.memberId);
      assert(blocked.ok, `blocking answered ${blocked.status}`);
      return { key, controller: "owner", ids: { userId: people.memberId } };
    }
    case "session":
      return await sessionTree(people);
    case "avatar":
      return await avatarTree(people);
    case "report":
      return await reportTree(people);
    default:
      return assertUnreachable(key);
  }
}

/** Only the trees a route is tried on: each costs its own requests. */
async function fixture(keys: readonly Key[]): Promise<Fixture> {
  const ownerCookie = await registerUser(OWNER);
  const operatorCookie = await makeOperator(
    OPERATOR,
    await registerUser(OPERATOR),
  );
  const people: People = {
    ownerCookie,
    ownerId: await getUserId(OWNER),
    memberCookie: await addMember(
      ownerCookie,
      (await createGroup(ownerCookie, "Treffpunkt")).id,
      MEMBER,
      "writer",
    ),
    memberId: await getUserId(MEMBER),
  };
  const strangerCookie = await registerUser(STRANGER);

  const trees: Tree[] = [];
  for (const key of keys) {
    // deno-lint-ignore no-await-in-loop -- sequential on purpose: trees share the owner
    trees.push(await tree(key, people));
  }

  return {
    ownerCookie,
    strangerCookie,
    strangerId: await getUserId(STRANGER),
    operatorCookie,
    trees,
  };
}

Deno.test("every route with an id in its path has a case", () => {
  const found = operations();
  assertEquals(
    found.filter(({ keys }) => keys === undefined).map(({ path }) => path),
    [],
    "Add these paths' prefix to SCOPES, with the rows their routes are tried on",
  );
  assertEquals(
    found.map(({ operation }) => operation).sort(),
    Object.keys(CASES).sort(),
    "Add a case for each new route, and remove the case of a route that is gone",
  );
  const withoutBody = found
    .filter(({ bodyRequired, operation }) =>
      bodyRequired && REQUEST_BODIES[operation] === undefined &&
      CASES[operation]?.body === undefined
    )
    .map(({ operation }) => operation);
  assertEquals(
    withoutBody,
    [],
    "Add these operations' bodies to REQUEST_BODIES in `test/route_fixtures.ts`",
  );
});

for (const { operation, method, path, keys } of operations()) {
  if (keys === undefined) {
    continue;
  }

  Deno.test(`${operation}, tried by a stranger`, async () => {
    const found = await fixture(keys);
    const test = CASES[operation];
    assert(test !== undefined, `${operation} has no case`);

    const body = (tree: Tree) =>
      test.body !== undefined ? test.body(tree) : REQUEST_BODIES[operation]?.({
        ...tree.ids,
        inviteeId: found.strangerId,
      });
    const ask = async (tree: Tree, ids: Ids, cookie: string) =>
      await answer(method, address(path, ids), cookie, await body(tree));

    const actual: Partial<Record<Key, number>> = {};
    const telling: string[] = [];
    const refused: string[] = [];
    for (const tree of found.trees) {
      const ids = { ...tree.ids, ...test.params?.(tree) };

      // deno-lint-ignore no-await-in-loop -- sequential: a control may change the rows
      const tried = await ask(tree, ids, found.strangerCookie);
      actual[tree.key] = tried.status;

      if (UNSEEN.has(tree.key)) {
        const missing = Object.fromEntries(
          Object.entries(ids).map(([name, id]) => [
            name,
            name === "targetType" ? id : missingId(),
          ]),
        );
        // deno-lint-ignore no-await-in-loop -- sequential on purpose, as above
        const nothing = await ask(tree, missing, found.strangerCookie);
        if (JSON.stringify(tried) !== JSON.stringify(nothing)) {
          telling.push(
            `${tree.key}: ${JSON.stringify(tried)}, missing ${
              JSON.stringify(nothing)
            }`,
          );
        }
      }

      // After the stranger, so a delete that got through leaves the controller nothing to delete.
      const controller = tree.controller === "owner"
        ? found.ownerCookie
        : found.operatorCookie;
      // deno-lint-ignore no-await-in-loop -- sequential on purpose, as above
      const control = await ask(tree, ids, controller);
      const expected = test.control?.[tree.key];
      if (
        expected === undefined
          ? control.status < 200 || control.status >= 300
          : control.status !== expected
      ) {
        refused.push(`${tree.key}: ${JSON.stringify(control)}`);
      }
    }

    assertEquals(
      actual,
      test.stranger,
      `${operation}: what a stranger gets, per tree`,
    );
    assertEquals(
      telling,
      [],
      `${operation}: a stranger can tell rows they cannot see from rows that do not exist`,
    );
    assertEquals(
      refused,
      [],
      `${operation}: the rows' controller was refused, so the request is malformed`,
    );
  });
}
