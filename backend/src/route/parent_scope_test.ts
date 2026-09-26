import { assert, assertEquals } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import openApi from "@/open-api.json" with { type: "json" };
import {
  addMember,
  clearRateLimits,
  deleteUsers,
  getUserId,
  registerUser,
} from "@/src/test/support.ts";
import { clearForum } from "@/src/test/forum.ts";
import {
  address,
  answer,
  forumWithChildren,
  groupWithChildren,
  type Ids,
  REQUEST_BODIES,
} from "@/src/test/route_fixtures.ts";

/**
 * Every route with a parent and a child in its path must refuse a child from somewhere else. The
 * routes come from `open-api.json`; `stranger_access_test.ts` is what makes a new one need a case.
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

type Tree = { scope: Scope; label: string; ids: Ids };

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

type Fixture = {
  attackerCookie: string;
  own: Record<Scope, Tree>;
  elsewhere: Tree[];
};

/** The attacker runs their own group and writes in the forum; the victim's rows are private. */
async function fixture(): Promise<Fixture> {
  const victimCookie = await registerUser(VICTIM);
  const victimId = await getUserId(VICTIM);
  const attackerCookie = await registerUser(ATTACKER);
  const attackerId = await getUserId(ATTACKER);

  const ownGroup = await groupWithChildren(
    attackerCookie,
    "the attacker's group",
  );
  await addMember(
    attackerCookie,
    ownGroup.groupId ?? "",
    ATTACKERS_MEMBER,
    "writer",
  );
  const otherGroup = await groupWithChildren(victimCookie, "another group");

  return {
    attackerCookie,
    own: {
      group: {
        scope: "group",
        label: "the attacker's group",
        ids: { ...ownGroup, userId: await getUserId(ATTACKERS_MEMBER) },
      },
      forum: {
        scope: "forum",
        label: "the attacker's forum thread",
        ids: await forumWithChildren("Eigenes", "write", attackerId),
      },
    },
    elsewhere: [
      {
        scope: "group",
        label: "another group",
        ids: { ...otherGroup, userId: victimId },
      },
      {
        scope: "forum",
        label: "another forum thread",
        ids: await forumWithChildren("Fremdes", "write", victimId),
      },
    ],
  };
}

type Probe = { label: string; ids: Ids; source: Tree };

/**
 * One probe per parent that can be swapped: the ids before `level` are the attacker's own, the
 * rest come from elsewhere. Level 0, a child of another scope, only makes sense across scopes.
 */
function probes(names: string[], scope: Scope, found: Fixture): Probe[] {
  const result: Probe[] = [];
  for (const source of found.elsewhere) {
    const first = source.scope === scope ? 1 : 0;
    for (let level = first; level < names.length; level++) {
      const ids: Ids = {};
      for (const [index, name] of names.entries()) {
        const id = index < level
          ? found.own[scope].ids[name]
          : source.ids[name];
        if (id !== undefined) {
          ids[name] = id;
        }
      }
      if (names.every((name) => name in ids)) {
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

for (const { operation, method, path, names } of nestedOperations()) {
  const scope: Scope = path.startsWith("/api/forum/") ? "forum" : "group";

  Deno.test(`${operation} answers 404 for a child of another parent`, async () => {
    const found = await fixture();
    const body = REQUEST_BODIES[operation];
    const each = probes(names, scope, found);
    assert(each.length > 0, `${operation} has nothing to probe`);

    const ask = async (ids: Ids, rows: Ids) =>
      await answer(
        method,
        address(path, ids),
        found.attackerCookie,
        await body?.(rows),
      );

    for (const probe of each) {
      // deno-lint-ignore no-await-in-loop -- sequential: a probe that got through changes rows
      const tried = await ask(probe.ids, probe.source.ids);
      assertEquals(
        tried.status,
        STATUS_CODE.NotFound,
        `${operation} with ${probe.label}`,
      );
    }

    // The attacker's own chain succeeds, so the 404s are the scope's, not a malformed request's.
    const own = found.own[scope].ids;
    const control = await ask(own, own);
    assert(
      control.status >= 200 && control.status < 300,
      `${operation} on the attacker's own chain: ${control.status}`,
    );
  });
}
