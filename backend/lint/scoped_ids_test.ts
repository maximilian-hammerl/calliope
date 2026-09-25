import { assertEquals } from "@std/assert";
import plugin from "./scoped_ids.ts";

const BACKEND = decodeURIComponent(new URL("../", import.meta.url).pathname);
const ROUTE = `${BACKEND}src/route/groups/group/threads/thread/get_thread.ts`;
const RESOLVER = `${BACKEND}src/scope/group_scope.ts`;
const SERVICE_TEST = `${BACKEND}src/service/writing_page_service_test.ts`;

function messages(file: string, source: string): string[] {
  return Deno.lint.runPlugin(plugin, file, source).map(({ message }) =>
    message
  );
}

Deno.test("a route may name the scoped ids but not make one", () => {
  assertEquals(
    messages(
      ROUTE,
      'import type { ThreadId } from "@/src/scope/scoped_id.ts";',
    ),
    [],
  );
  assertEquals(
    messages(
      ROUTE,
      'import { type ThreadId, mint } from "@/src/scope/scoped_id.ts";',
    ),
    ["Only `src/scope/` makes a scoped id"],
  );
  assertEquals(
    messages(ROUTE, 'export { mint } from "@/src/scope/scoped_id.ts";'),
    ["Only `src/scope/` makes a scoped id"],
  );
});

Deno.test("a cast to a scoped id is refused outside `src/scope/`, however it is dressed", () => {
  for (
    const source of [
      "const id = raw as ThreadId;",
      "const id = raw as unknown as FolderId | null;",
      "const id = <PostId> raw;",
      "const ids = raw as Array<MemberId>;",
    ]
  ) {
    assertEquals(
      messages(ROUTE, source),
      ["A cast to a scoped id skips its resolver"],
      source,
    );
  }
  assertEquals(messages(ROUTE, "const id = raw as string;"), []);
  assertEquals(messages(RESOLVER, "const id = raw as ThreadId;"), []);
});

Deno.test("the scope directory mints, and only tests use the test helper", () => {
  assertEquals(
    messages(RESOLVER, 'import { mint } from "@/src/scope/scoped_id.ts";'),
    [],
  );
  assertEquals(
    messages(SERVICE_TEST, 'import { scoped } from "@/src/test/scope.ts";'),
    [],
  );
  assertEquals(
    messages(ROUTE, 'import { scoped } from "@/src/test/scope.ts";'),
    ["`src/test/scope.ts` is for tests"],
  );
});
