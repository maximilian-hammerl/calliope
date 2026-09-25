import { assert, assertEquals } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import openApi from "@/open-api.json" with { type: "json" };
import { db } from "@/src/database/client.ts";
import { plainTextToDocument } from "@/src/document/document_text.ts";
import {
  addMember,
  clearRateLimits,
  createGroup,
  deleteUsers,
  getUserId,
  postBody,
  registerUser,
  request,
} from "@/src/test/support.ts";
import {
  clearForum,
  createForumFolder,
  createForumPage,
  createForumPost,
  createForumThread,
} from "@/src/test/forum.ts";

/**
 * A route whose path names a child under a parent asks the member's rights of the parent, so it
 * must refuse a child that belongs elsewhere — or those rights reach it. The routes come from
 * `open-api.json`, so a new one fails here until it has a case.
 */

const VICTIM = "parent-scope-victim";
const ATTACKER = "parent-scope-attacker";
const ATTACKERS_MEMBER = "parent-scope-member";

Deno.test.beforeEach(clearRateLimits);
Deno.test.afterEach(async () => {
  await clearForum([VICTIM, ATTACKER, ATTACKERS_MEMBER]);
  await deleteUsers([VICTIM, ATTACKER, ATTACKERS_MEMBER]);
});

type Scope = "group" | "forum";

type Ids = Partial<Record<string, string>>;

type Tree = {
  scope: Scope;
  label: string;
  ids: Ids;
  pageLoadedAt?: string;
};

type Case = {
  /** Given the tree whose child is addressed. */
  body?: (target: Tree) => unknown;
};

const CASES: Record<string, Case> = {
  "PUT /api/groups/{groupId}/folders/{folderId}": {
    body: () => ({ title: "Umbenannt", description: null }),
  },
  "DELETE /api/groups/{groupId}/folders/{folderId}": {},
  "PUT /api/groups/{groupId}/folders/{folderId}/parent": {
    body: () => ({ parentFolderId: null }),
  },
  "PATCH /api/groups/{groupId}/memberships/{userId}": {
    body: () => ({ role: "reader" }),
  },
  "DELETE /api/groups/{groupId}/memberships/{userId}": {},
  "GET /api/groups/{groupId}/pages/{pageId}": {},
  "PUT /api/groups/{groupId}/pages/{pageId}": {
    body: (target) => ({
      title: "Umbenannt",
      document: plainTextToDocument("Neu"),
      loadedAt: target.pageLoadedAt,
    }),
  },
  "DELETE /api/groups/{groupId}/pages/{pageId}": {},
  "PUT /api/groups/{groupId}/pages/{pageId}/folder": {
    body: () => ({ folderId: null }),
  },
  "PATCH /api/groups/{groupId}/steps/{stepId}": {
    body: () => ({ done: true }),
  },
  "DELETE /api/groups/{groupId}/steps/{stepId}": {},
  "GET /api/groups/{groupId}/threads/{threadId}": {},
  "PATCH /api/groups/{groupId}/threads/{threadId}": {
    body: () => ({ title: "Umbenannt" }),
  },
  "DELETE /api/groups/{groupId}/threads/{threadId}": {},
  "POST /api/groups/{groupId}/threads/{threadId}/posts": {
    body: () => postBody("Dazwischen"),
  },
  "QUERY /api/groups/{groupId}/threads/{threadId}/posts": {
    body: () => ({}),
  },
  "GET /api/groups/{groupId}/threads/{threadId}/posts/{postId}": {},
  "PATCH /api/groups/{groupId}/threads/{threadId}/posts/{postId}": {
    body: () => postBody("Überschrieben"),
  },
  "DELETE /api/groups/{groupId}/threads/{threadId}/posts/{postId}": {},
  "PUT /api/groups/{groupId}/threads/{threadId}/folder": {
    body: () => ({ folderId: null }),
  },
  "PATCH /api/forum/threads/{threadId}/posts/{postId}": {
    body: () => postBody("Überschrieben"),
  },
  "DELETE /api/forum/threads/{threadId}/posts/{postId}": {},
};

type Parameter = { in: string; name: string; schema?: { enum?: unknown } };

/** The path's ids in order. A parameter with an enum names a kind, not a parent. */
function idNames(path: string, parameters: Parameter[]): string[] {
  const kinds = new Set(
    parameters
      .filter((parameter) => parameter.in === "path" && parameter.schema?.enum)
      .map((parameter) => parameter.name),
  );
  return [...path.matchAll(/\{(\w+)\}/g)].flatMap(([, name]) =>
    name === undefined || kinds.has(name) ? [] : [name]
  );
}

type Nested = {
  operation: string;
  method: string;
  path: string;
  names: string[];
};

function nestedOperations(): Nested[] {
  const operations: Nested[] = [];
  for (const [path, item] of Object.entries(openApi.paths)) {
    for (const [method, operation] of Object.entries(item)) {
      const parameters = (operation as { parameters?: Parameter[] })
        .parameters ?? [];
      const names = idNames(path, parameters);
      if (names.length >= 2) {
        const upper = method.toUpperCase();
        operations.push({
          operation: `${upper} ${path}`,
          method: upper,
          path,
          names,
        });
      }
    }
  }
  return operations;
}

async function pageLoadedAt(pageId: string): Promise<string> {
  const page = await db
    .selectFrom("writingPage")
    .select("lastActivityAt")
    .where("id", "=", pageId)
    .executeTakeFirstOrThrow();
  return page.lastActivityAt;
}

/** A group with one of every child, all at the root so an empty folder can be deleted. */
async function groupTree(cookie: string, label: string): Promise<Tree> {
  const group = await createGroup(cookie, label);
  const base = `/api/groups/${group.id}`;
  const created = async (path: string, body: unknown) => {
    const response = await request("POST", `${base}${path}`, cookie, body);
    assertEquals(response.status, STATUS_CODE.Created, `POST ${path}`);
    return await response.json();
  };

  const thread = await created("/threads", { title: "Kapitel" });
  const post = await created(`/threads/${thread.id}/posts`, postBody("Text"));
  const page = await created("/pages", {
    title: "Figuren",
    document: plainTextToDocument("Liste"),
  });
  const folder = await created("/folders", { title: "Leer" });
  const step = await created("/steps", { text: "Planen" });

  return {
    scope: "group",
    label,
    ids: {
      groupId: group.id,
      threadId: thread.id,
      postId: post.id,
      pageId: page.id,
      folderId: folder.id,
      stepId: step.id,
    },
    pageLoadedAt: page.lastActivityAt,
  };
}

/** Forum rows sit in a `write` folder: at the root only operators may write. */
async function forumTree(label: string, authorId: string): Promise<Tree> {
  const folder = await createForumFolder(`${label} Raum`, "write");
  const thread = await createForumThread(label, "write", folder.id);
  const post = await createForumPost(thread.id, "Text", authorId);
  const page = await createForumPage(label, "Liste", "write", folder.id);

  return {
    scope: "forum",
    label,
    ids: {
      threadId: thread.id,
      postId: post.id,
      pageId: page.id,
      folderId: folder.id,
    },
    pageLoadedAt: await pageLoadedAt(page.id),
  };
}

type Fixture = {
  attackerCookie: string;
  own: Record<Scope, Tree>;
  elsewhere: Tree[];
};

/** The attacker administers their own group and writes in the forum; the victim's rows are private. */
async function fixture(): Promise<Fixture> {
  const victimCookie = await registerUser(VICTIM);
  const victimId = await getUserId(VICTIM);
  const attackerCookie = await registerUser(ATTACKER);
  const attackerId = await getUserId(ATTACKER);

  const ownGroup = await groupTree(attackerCookie, "the attacker's group");
  await addMember(
    attackerCookie,
    ownGroup.ids.groupId ?? "",
    ATTACKERS_MEMBER,
    "writer",
  );
  ownGroup.ids.userId = await getUserId(ATTACKERS_MEMBER);
  const otherGroup = await groupTree(victimCookie, "another group");
  otherGroup.ids.userId = victimId;

  return {
    attackerCookie,
    own: {
      group: ownGroup,
      forum: await forumTree("the attacker's forum thread", attackerId),
    },
    elsewhere: [
      otherGroup,
      await forumTree("another forum thread", victimId),
    ],
  };
}

type Probe = { label: string; ids: Ids; source: Tree };

/**
 * One probe per parent that can be swapped: the ids before `level` are the attacker's own, the
 * rest come from elsewhere. Level 0 addresses a child of another scope entirely — a group's
 * thread through the forum's path — and only makes sense across scopes.
 */
function probes(names: string[], scope: Scope, found: Fixture): Probe[] {
  const result: Probe[] = [];
  for (const source of found.elsewhere) {
    const first = source.scope === scope ? 1 : 0;
    for (let level = first; level < names.length; level++) {
      const ids = Object.fromEntries(names.map((name, index) => [
        name,
        index < level ? found.own[scope].ids[name] : source.ids[name],
      ]));
      if (names.every((name) => ids[name] !== undefined)) {
        result.push({
          label: `${names[level]} from ${source.label}`,
          ids,
          source,
        });
      }
    }
  }
  return result;
}

/** A name without an id stays in braces, which the route refuses as malformed. */
function address(path: string, ids: Ids): string {
  return path.replace(/\{(\w+)\}/g, (whole, name) => ids[name] ?? whole);
}

async function status(
  method: string,
  path: string,
  cookie: string,
  body: unknown,
): Promise<number> {
  const response = await request(method, path, cookie, body);
  await response.body?.cancel();
  return response.status;
}

Deno.test("every route with a parent and a child in its path has a case", () => {
  const operations = nestedOperations().map(({ operation }) => operation)
    .sort();
  assertEquals(
    operations,
    Object.keys(CASES).sort(),
    "Add a case for each new route, and remove the case of a route that is gone",
  );
});

for (const { operation, method, path, names } of nestedOperations()) {
  const scope: Scope = path.startsWith("/api/forum/") ? "forum" : "group";

  Deno.test(`${operation} answers 404 for a child of another parent`, async () => {
    const found = await fixture();
    const body = CASES[operation]?.body;
    const each = probes(names, scope, found);
    assert(each.length > 0, `${operation} has nothing to probe`);

    for (const probe of each) {
      assertEquals(
        // deno-lint-ignore no-await-in-loop -- sequential on purpose: a probe that gets through may change what the next one finds
        await status(
          method,
          address(path, probe.ids),
          found.attackerCookie,
          body?.(probe.source),
        ),
        STATUS_CODE.NotFound,
        `${operation} with ${probe.label}`,
      );
    }

    // The same request on the attacker's own chain succeeds, so the 404s above are the scope's
    // doing and not a malformed body or a wrong id.
    const own = found.own[scope];
    const control = await status(
      method,
      address(path, own.ids),
      found.attackerCookie,
      body?.(own),
    );
    assert(
      control >= 200 && control < 300,
      `${operation} on the attacker's own chain: ${control}`,
    );
  });
}
