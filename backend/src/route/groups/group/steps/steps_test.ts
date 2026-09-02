import { assertEquals, assertExists } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import { db } from "@/src/database/client.ts";
import {
  addMember,
  clearRateLimits,
  createGroup,
  deleteUsers,
  registerUser,
  request,
} from "@/src/test/support.ts";

const administrator = "steps-test-admin";
const writer = "steps-test-writer";
const reader = "steps-test-reader";
const stranger = "steps-test-stranger";

Deno.test.beforeEach(clearRateLimits);
Deno.test.afterEach(() =>
  deleteUsers([administrator, writer, reader, stranger])
);

async function groupWithStep(adminCookie: string) {
  const group = await createGroup(adminCookie, "Schrittmacher");
  const created = await request(
    "POST",
    `/api/groups/${group.id}/steps`,
    adminCookie,
    { text: "Kapitel 2 anlegen" },
  );
  assertEquals(created.status, STATUS_CODE.Created);
  const step = await created.json();
  return { group, step };
}

Deno.test("POST /api/groups/{groupId}/steps adds a step with its author", async () => {
  const adminCookie = await registerUser(administrator);
  const { step } = await groupWithStep(adminCookie);

  assertEquals(step.text, "Kapitel 2 anlegen");
  assertEquals(step.createdByUsername, administrator);
  assertEquals(step.completedAt, null);
  assertEquals(step.completedByUsername, null);
});

Deno.test("POST /api/groups/{groupId}/steps refuses a reader with 403", async () => {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Schrittmacher");
  const readerCookie = await addMember(adminCookie, group.id, reader, "reader");

  const response = await request(
    "POST",
    `/api/groups/${group.id}/steps`,
    readerCookie,
    { text: "Sollte nicht gehen" },
  );

  // 403, not 404: the reader can see the group, so its existence is no secret.
  assertEquals(response.status, STATUS_CODE.Forbidden);
});

Deno.test("GET /api/groups/{groupId}/steps answers 404 for a stranger to a private group", async () => {
  const adminCookie = await registerUser(administrator);
  const { group } = await groupWithStep(adminCookie);
  const strangerCookie = await registerUser(stranger);

  const response = await request(
    "GET",
    `/api/groups/${group.id}/steps`,
    strangerCookie,
  );

  assertEquals(response.status, STATUS_CODE.NotFound);
});

Deno.test("GET /api/groups/{groupId}/steps lets a reader read", async () => {
  const adminCookie = await registerUser(administrator);
  const { group } = await groupWithStep(adminCookie);
  const readerCookie = await addMember(adminCookie, group.id, reader, "reader");

  const response = await request(
    "GET",
    `/api/groups/${group.id}/steps`,
    readerCookie,
  );

  assertEquals(response.status, STATUS_CODE.OK);
  const { results } = await response.json();
  assertEquals(results.length, 1);
});

Deno.test("PATCH ticks a step, and the first completer wins", async () => {
  const adminCookie = await registerUser(administrator);
  const { group, step } = await groupWithStep(adminCookie);
  const writerCookie = await addMember(adminCookie, group.id, writer, "writer");

  const ticked = await request(
    "PATCH",
    `/api/groups/${group.id}/steps/${step.id}`,
    writerCookie,
    { done: true },
  );
  assertEquals(ticked.status, STATUS_CODE.OK);
  const first = await ticked.json();
  assertEquals(first.completedByUsername, writer);
  assertExists(first.completedAt);

  // The admin ticking it again must not steal the completion.
  const again = await request(
    "PATCH",
    `/api/groups/${group.id}/steps/${step.id}`,
    adminCookie,
    { done: true },
  );
  assertEquals(again.status, STATUS_CODE.OK);
  const second = await again.json();
  assertEquals(second.completedByUsername, writer);
  assertEquals(second.completedAt, first.completedAt);
});

Deno.test("PATCH reopens a step, clearing both completion columns", async () => {
  const adminCookie = await registerUser(administrator);
  const { group, step } = await groupWithStep(adminCookie);

  await request(
    "PATCH",
    `/api/groups/${group.id}/steps/${step.id}`,
    adminCookie,
    {
      done: true,
    },
  );
  const reopened = await request(
    "PATCH",
    `/api/groups/${group.id}/steps/${step.id}`,
    adminCookie,
    { done: false },
  );

  assertEquals(reopened.status, STATUS_CODE.OK);
  const body = await reopened.json();
  assertEquals(body.completedAt, null);
  assertEquals(body.completedByUsername, null);
});

Deno.test("PATCH refuses a reader with 403", async () => {
  const adminCookie = await registerUser(administrator);
  const { group, step } = await groupWithStep(adminCookie);
  const readerCookie = await addMember(adminCookie, group.id, reader, "reader");

  const response = await request(
    "PATCH",
    `/api/groups/${group.id}/steps/${step.id}`,
    readerCookie,
    { done: true },
  );

  assertEquals(response.status, STATUS_CODE.Forbidden);
});

Deno.test("PATCH answers 404 for a step of another group", async () => {
  const adminCookie = await registerUser(administrator);
  const { step } = await groupWithStep(adminCookie);
  const otherGroup = await createGroup(adminCookie, "Anderes Buch");

  // A real step, but reached through the wrong group's path.
  const response = await request(
    "PATCH",
    `/api/groups/${otherGroup.id}/steps/${step.id}`,
    adminCookie,
    { done: true },
  );

  assertEquals(response.status, STATUS_CODE.NotFound);
});

Deno.test("DELETE allows the creator and an administrator, but not another writer", async () => {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Schrittmacher");
  const writerCookie = await addMember(adminCookie, group.id, writer, "writer");

  const created = await request(
    "POST",
    `/api/groups/${group.id}/steps`,
    writerCookie,
    { text: "Vom Schreiber" },
  );
  const step = await created.json();

  // Another member who neither created it nor administers may not delete it.
  const readerTurnedWriter = await addMember(
    adminCookie,
    group.id,
    reader,
    "writer",
  );
  const refused = await request(
    "DELETE",
    `/api/groups/${group.id}/steps/${step.id}`,
    readerTurnedWriter,
  );
  assertEquals(refused.status, STATUS_CODE.Forbidden);

  const byCreator = await request(
    "DELETE",
    `/api/groups/${group.id}/steps/${step.id}`,
    writerCookie,
  );
  assertEquals(byCreator.status, STATUS_CODE.OK);
});

Deno.test("a completed step survives its completer's account deletion", async () => {
  const adminCookie = await registerUser(administrator);
  const { group, step } = await groupWithStep(adminCookie);
  const writerCookie = await addMember(adminCookie, group.id, writer, "writer");

  await request(
    "PATCH",
    `/api/groups/${group.id}/steps/${step.id}`,
    writerCookie,
    {
      done: true,
    },
  );

  // The completer's account goes; SET NULL fires, and the CHECK must allow a completion
  // time without a completer — the asymmetry the constraint exists to permit.
  await db.deleteFrom("user").where("username", "=", writer).execute();

  const response = await request(
    "GET",
    `/api/groups/${group.id}/steps`,
    adminCookie,
  );
  const { results } = await response.json();
  assertEquals(results.length, 1);
  assertExists(results[0].completedAt);
  assertEquals(results[0].completedByUsername, null);
});

Deno.test("completing and creating steps moves no lastActivityAt", async () => {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Stille Planung");

  const before = await db
    .selectFrom("writingGroup")
    .select("lastActivityAt")
    .where("id", "=", group.id)
    .executeTakeFirstOrThrow();

  const created = await request(
    "POST",
    `/api/groups/${group.id}/steps`,
    adminCookie,
    { text: "Leise bleiben" },
  );
  const step = await created.json();
  await request(
    "PATCH",
    `/api/groups/${group.id}/steps/${step.id}`,
    adminCookie,
    {
      done: true,
    },
  );

  const after = await db
    .selectFrom("writingGroup")
    .select("lastActivityAt")
    .where("id", "=", group.id)
    .executeTakeFirstOrThrow();

  // Planning is not writing: the group list must not reorder because somebody ticked a box.
  assertEquals(after.lastActivityAt, before.lastActivityAt);
});

/**
 * The other half of the step's split rule. Ticking is any writer's — the test above has an
 * administrator write a step and a writer complete it — but deleting removes somebody's note
 * from the group's plan, so it stays with whoever wrote it.
 */
Deno.test("DELETE refuses a writer who did not write the step", async () => {
  const adminCookie = await registerUser(administrator);
  const { group, step } = await groupWithStep(adminCookie);
  const writerCookie = await addMember(adminCookie, group.id, writer, "writer");

  const refused = await request(
    "DELETE",
    `/api/groups/${group.id}/steps/${step.id}`,
    writerCookie,
  );
  assertEquals(refused.status, STATUS_CODE.Forbidden);

  // Still there, and its own author may remove it.
  const byAuthor = await request(
    "DELETE",
    `/api/groups/${group.id}/steps/${step.id}`,
    adminCookie,
  );
  assertEquals(byAuthor.status, STATUS_CODE.OK);
});

Deno.test("DELETE lets an administrator remove somebody else's step", async () => {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Schrittmacher");
  const writerCookie = await addMember(adminCookie, group.id, writer, "writer");

  const theirs = await (await request(
    "POST",
    `/api/groups/${group.id}/steps`,
    writerCookie,
    { text: "Von jemand anderem" },
  )).json();

  const response = await request(
    "DELETE",
    `/api/groups/${group.id}/steps/${theirs.id}`,
    adminCookie,
  );
  assertEquals(response.status, STATUS_CODE.OK);
});
