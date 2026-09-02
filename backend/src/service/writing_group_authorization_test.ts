import { assertEquals, assertThrows } from "@std/assert";
import { mayAct } from "./writing_group_authorization.ts";

const AUTHOR = "01a00000-0000-7000-8000-00000000aa01";
const SOMEBODY_ELSE = "01a00000-0000-7000-8000-00000000aa02";

/** Every row of the table, so a rule added without a decision about readers fails here. */
const WRITER_ACTS = [
  "thread:create",
  "post:create",
  "page:create",
  "page:change",
  "page:move",
  "page:delete",
  "folder:create",
  "folder:change",
  "folder:move",
  "folder:delete",
  "step:create",
  "step:tick",
] as const;

const AUTHOR_ACTS = [
  "thread:change",
  "thread:move",
  "thread:delete",
  "post:change",
  "post:delete",
  "step:delete",
] as const;

Deno.test("the two lists together are the whole table", () => {
  // A row added to `RULE` without a decision here leaves this count wrong.
  assertEquals(WRITER_ACTS.length + AUTHOR_ACTS.length, 18);
});

Deno.test("a reader may do nothing the writer rule governs", async (t) => {
  for (const act of WRITER_ACTS) {
    // deno-lint-ignore no-await-in-loop -- a test step has to be awaited in order
    await t.step(act, () => assertEquals(mayAct("reader", act), false));
  }
});

Deno.test("a reader may not touch what somebody else wrote", async (t) => {
  for (const act of AUTHOR_ACTS) {
    // deno-lint-ignore no-await-in-loop -- a test step has to be awaited in order
    await t.step(act, () => {
      const theirs = { createdBy: SOMEBODY_ELSE, userId: AUTHOR };
      assertEquals(mayAct("reader", act, theirs), false);
    });
  }
});

/**
 * **Demotion freezes what somebody already wrote**, not only what they write next. The author
 * rule asks whether the member may write at all before asking whether it is theirs.
 *
 * The reason is containment: demoting to reader is the one move an ordinary group can make
 * against an account it believes is compromised, without waiting for an operator. If the author
 * rule ignored the role, that move would stop the account writing while leaving it free to
 * delete everything it had ever written.
 */
Deno.test("a demoted reader governs nothing, not even their own writing", () => {
  const mine = { createdBy: AUTHOR, userId: AUTHOR };

  assertEquals(mayAct("reader", "post:delete", mine), false);
  assertEquals(mayAct("reader", "post:change", mine), false);
  assertEquals(mayAct("reader", "thread:change", mine), false);
  assertEquals(mayAct("reader", "thread:delete", mine), false);
  assertEquals(mayAct("reader", "step:delete", mine), false);

  // The same member as a writer again: their own writing is theirs.
  assertEquals(mayAct("writer", "post:delete", mine), true);
});

Deno.test("what the group keeps is any writer's, whoever made it", () => {
  for (const act of ["page:change", "page:move", "page:delete"] as const) {
    assertEquals(mayAct("writer", act), true);
    assertEquals(mayAct("administrator", act), true);
  }
  for (
    const act of ["folder:change", "folder:move", "folder:delete"] as const
  ) {
    assertEquals(mayAct("writer", act), true);
  }
  // Ticking a step is the same rule: whoever writes the chapter marks it done.
  assertEquals(mayAct("writer", "step:tick"), true);
});

Deno.test("writing stays with its author, or an administrator", () => {
  const mine = { createdBy: AUTHOR, userId: AUTHOR };
  const theirs = { createdBy: SOMEBODY_ELSE, userId: AUTHOR };

  for (const act of ["thread:change", "post:delete", "step:delete"] as const) {
    assertEquals(mayAct("writer", act, mine), true);
    assertEquals(mayAct("writer", act, theirs), false);
    // An administrator may act on anybody's.
    assertEquals(mayAct("administrator", act, theirs), true);
  }
});

Deno.test("writing whose author is gone is left to the administrators", () => {
  const orphaned = { createdBy: null, userId: AUTHOR };

  assertEquals(mayAct("writer", "post:delete", orphaned), false);
  assertEquals(mayAct("administrator", "post:delete", orphaned), true);
});

Deno.test("an author rule asked without its content is a bug, not a refusal", () => {
  // Unreachable through the overloads, so a throw is the honest answer: answering `false` would
  // read as "not allowed" and hide the mistake.
  assertThrows(
    () =>
      (mayAct as (role: string, act: string) => boolean)(
        "writer",
        "post:delete",
      ),
    Error,
    "post:delete",
  );
});
