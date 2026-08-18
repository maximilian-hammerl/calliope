import { assert, assertEquals } from "@std/assert";
import {
  addMember,
  cleanUp,
  client,
  connect,
  insertGroup,
  insertUser,
  membershipTimestamps,
} from "./support.ts";

Deno.test.beforeEach(connect);
Deno.test.afterEach(cleanUp);

Deno.test("an invitation records when it was sent, and nothing else", async () => {
  const userId = await insertUser("membership-invited");
  const groupId = await insertGroup("membership-invited-group");

  await addMember(groupId, userId, "invited");

  const { invitedAt, joinedAt } = await membershipTimestamps(groupId, userId);
  assert(invitedAt !== null);
  assertEquals(joinedAt, null, "nobody has joined yet");
});

Deno.test("a member inserted as joined records both", async () => {
  const userId = await insertUser("membership-founder");
  const groupId = await insertGroup("membership-founder-group");

  // The founder of a group, who is never invited to it.
  await addMember(groupId, userId, "joined");

  const { invitedAt, joinedAt } = await membershipTimestamps(groupId, userId);
  assert(invitedAt !== null);
  assert(joinedAt !== null);
});

Deno.test("accepting an invitation records when it was accepted", async () => {
  const userId = await insertUser("membership-accept");
  const groupId = await insertGroup("membership-accept-group");
  await addMember(groupId, userId, "invited");

  const invited = await membershipTimestamps(groupId, userId);

  // Accepting is an UPDATE, not an insert. Setting these on insert alone would leave every
  // member who arrived by invitation with no joined_at at all.
  await client.query(
    `UPDATE public.user_in_writing_group SET status = 'joined'
     WHERE writing_group_id = $1 AND user_id = $2`,
    [groupId, userId],
  );

  const joined = await membershipTimestamps(groupId, userId);
  assertEquals(joined.invitedAt, invited.invitedAt, "the invitation stands");
  assert(joined.joinedAt !== null);
});

Deno.test("a later change does not move the joining date", async () => {
  const userId = await insertUser("membership-role");
  const groupId = await insertGroup("membership-role-group");
  await addMember(groupId, userId, "joined");

  const before = await membershipTimestamps(groupId, userId);

  await client.query(
    `UPDATE public.user_in_writing_group SET role = 'reader'
     WHERE writing_group_id = $1 AND user_id = $2`,
    [groupId, userId],
  );

  assertEquals(await membershipTimestamps(groupId, userId), before);
});
