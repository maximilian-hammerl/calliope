import { assertEquals, assertExists } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import { db } from "@/src/database/client.ts";
import {
  addMember,
  clearRateLimits,
  createGroup,
  deleteUsers,
  postBody,
  request,
} from "@/src/test/support.ts";
import { flushBackgroundWork } from "@/src/util/background.ts";
import { waitForMail } from "@/src/test/mailpit.ts";
import { accountDeletionFixture } from "@/src/test/account_deletion.ts";

// Its own account and mailbox, so the file next door cannot clear them.
const {
  accountExists,
  clearMail,
  confirmDeletion,
  deletionToken,
  emailAddress,
  mailCount,
  registerDeletable,
  requestDeletion,
  sessionCount,
  username,
} = accountDeletionFixture("confirm");

const other = "account-deletion-test-witness";

Deno.test.beforeEach(async () => {
  await clearRateLimits();
  await clearMail();
});
Deno.test.afterEach(() => deleteUsers([username, other]));

/** Asks for deletion and returns the token the mail carried. */
async function requestAndReadToken(cookie: string): Promise<string> {
  const response = await requestDeletion(cookie);
  assertEquals(response.status, STATUS_CODE.OK);
  const token = await deletionToken();
  await clearMail();
  return token;
}

Deno.test("POST /api/auth/account/deletion/confirm deletes the account and its sessions", async () => {
  const cookie = await registerDeletable();
  const token = await requestAndReadToken(cookie);

  const response = await confirmDeletion(token);
  assertEquals(response.status, STATUS_CODE.OK);

  assertEquals(await accountExists(), false);
  // Cascaded, not cleaned up by hand: the session that asked cannot outlive the account.
  assertEquals(await sessionCount(), 0);
});

Deno.test("POST /api/auth/account/deletion/confirm keeps the writing and drops the name", async () => {
  const cookie = await registerDeletable();
  const group = await createGroup(cookie, "Bleibt bestehen");
  await addMember(cookie, group.id, other, "writer");

  const thread = await request(
    "POST",
    `/api/groups/${group.id}/threads`,
    cookie,
    { title: "Ein Kapitel" },
  );
  assertEquals(thread.status, STATUS_CODE.Created);
  const { id: threadId } = await thread.json();

  const post = await request(
    "POST",
    `/api/groups/${group.id}/threads/${threadId}/posts`,
    cookie,
    postBody("Was geschrieben wurde, bleibt."),
  );
  assertEquals(post.status, STATUS_CODE.Created);
  const { id: postId } = await post.json();

  await confirmDeletion(await requestAndReadToken(cookie));

  // The text is somebody else's story too, so it survives with its author set to null —
  // which is what the interface shows as "Gelöschtes Konto".
  const survivor = await db
    .selectFrom("writingPost")
    .select(["text", "createdBy"])
    .where("id", "=", postId)
    .executeTakeFirst();

  assertExists(survivor);
  assertEquals(survivor.text, "Was geschrieben wurde, bleibt.");
  assertEquals(survivor.createdBy, null);

  // The group had another member, so it is still there.
  const stillThere = await db
    .selectFrom("writingGroup")
    .select(["id", "createdBy"])
    .where("id", "=", group.id)
    .executeTakeFirst();

  assertExists(stillThere);
  assertEquals(stillThere.createdBy, null);
});

Deno.test("POST /api/auth/account/deletion/confirm lets the trigger remove a group nobody is left in", async () => {
  const cookie = await registerDeletable();
  const group = await createGroup(cookie, "Bleibt nicht bestehen");

  await confirmDeletion(await requestAndReadToken(cookie));

  // Nothing in the service says this: the membership cascades, and the trigger on
  // user_in_writing_group takes the group with it.
  const gone = await db
    .selectFrom("writingGroup")
    .select("id")
    .where("id", "=", group.id)
    .executeTakeFirst();

  assertEquals(gone, undefined);
});

Deno.test("POST /api/auth/account/deletion/confirm takes the member's story ideas with it", async () => {
  const cookie = await registerDeletable();
  const created = await request("POST", "/api/story-ideas", cookie, {
    title: "Stirbt mit dem Konto",
    teaser: "Ein Gesuch, nicht Teil einer fremden Geschichte.",
    synopsis: "Eine Idee ist ein Gesuch, nicht Teil einer fremden Geschichte.",
  });
  const { id } = await created.json();

  await confirmDeletion(await requestAndReadToken(cookie));

  // CASCADE, unlike a post's SET NULL: nobody else has written into an idea.
  const gone = await db
    .selectFrom("storyIdea")
    .select("id")
    .where("id", "=", id)
    .executeTakeFirst();

  assertEquals(gone, undefined);
});

Deno.test("POST /api/auth/account/deletion/confirm tells the address it is done", async () => {
  const cookie = await registerDeletable();
  const token = await requestAndReadToken(cookie);

  await confirmDeletion(token);
  await flushBackgroundWork();

  // Sent after the row is gone, so the address has to be read before the delete.
  const mail = await waitForMail(emailAddress);
  assertEquals(await mailCount(), 1);
  assertEquals(mail.to, emailAddress);
});

Deno.test("POST /api/auth/account/deletion/confirm spends the link once", async () => {
  const cookie = await registerDeletable();
  const token = await requestAndReadToken(cookie);

  assertEquals((await confirmDeletion(token)).status, STATUS_CODE.OK);

  const second = await confirmDeletion(token);
  assertEquals(second.status, STATUS_CODE.Gone);
});

Deno.test("POST /api/auth/account/deletion/confirm refuses a token it never issued", async () => {
  const cookie = await registerDeletable();
  await requestAndReadToken(cookie);

  // Malformed rather than merely wrong: the id half reaches a uuid column, where an
  // unparsed value is a database error instead of a miss.
  const responses = await Promise.all(
    ["nonsense", "not-a-uuid.secret", ""].map(confirmDeletion),
  );

  for (const response of responses) {
    assertEquals(
      response.status === STATUS_CODE.Gone ||
        response.status === STATUS_CODE.BadRequest,
      true,
      `answered ${response.status}`,
    );
  }

  assertEquals(await accountExists(), true);
});
