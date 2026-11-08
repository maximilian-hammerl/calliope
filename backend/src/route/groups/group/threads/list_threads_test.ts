import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { STATUS_CODE } from "@/src/http/status.ts";
import {
  addMember,
  clearRateLimits,
  createGroup,
  deleteUsers,
  registerUser,
  request,
} from "@/src/test/support.ts";

const administrator = "list-threads-admin";
const reader = "list-threads-reader";
const outsider = "list-threads-outsider";

beforeEach(clearRateLimits);
afterEach(() => deleteUsers([administrator, reader, outsider]));

test("GET /api/groups/{groupId}/threads lists threads for any member", async () => {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Fäden");
  const readerCookie = await addMember(adminCookie, group.id, reader, "reader");
  await request("POST", `/api/groups/${group.id}/threads`, adminCookie, {
    title: "Kapitel 1",
  });

  // A reader may not write, but may read.
  const response = await request("GET", `/api/groups/${group.id}/threads`, readerCookie);

  assert.equal(response.status, STATUS_CODE.OK);
  const page = await response.json();
  assert.equal(page.results[0].title, "Kapitel 1");
});

test("GET /api/groups/{groupId}/threads shows a public group's threads to a non-member", async () => {
  const adminCookie = await registerUser(administrator);
  const outsiderCookie = await registerUser(outsider);
  const group = await createGroup(adminCookie, "Fäden", "public");
  const thread = await request("POST", `/api/groups/${group.id}/threads`, adminCookie, {
    title: "Kapitel 1",
  });
  assert.equal(thread.status, STATUS_CODE.Created);

  // §23's "community-visible" is a promise about the writing, not only about the title, and
  // the discovery page states it outright: "Mitlesen kannst du sofort". This once answered
  // 404 while the same group's members and next steps were already readable.
  const response = await request("GET", `/api/groups/${group.id}/threads`, outsiderCookie);

  assert.equal(response.status, STATUS_CODE.OK);
  const page = await response.json();
  assert.deepEqual(
    page.results.map((one: { title: string }) => one.title),
    ["Kapitel 1"],
  );
});

test("GET /api/groups/{groupId}/threads still hides a private group's threads", async () => {
  const adminCookie = await registerUser(administrator);
  const outsiderCookie = await registerUser(outsider);
  const group = await createGroup(adminCookie, "Verschlossen", "private");

  const response = await request("GET", `/api/groups/${group.id}/threads`, outsiderCookie);

  // 404 rather than 403: a private group's existence is nobody else's business.
  assert.equal(response.status, STATUS_CODE.NotFound);
});
