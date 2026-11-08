import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { randomUUIDv7 } from "node:crypto";
import { utimes } from "node:fs/promises";
import { db } from "#/src/database/client.ts";
import { FileStore } from "#/src/storage/file_store.ts";
import { toAvatar } from "#/src/image/avatar_image.ts";
import { UserAvatarService } from "./user_avatar_service.ts";
import { clearRateLimits, deleteUsers, registerUser, write } from "#/src/test/support.ts";

const USERNAMES = [
  "avatar-set",
  "avatar-refused",
  "avatar-replace",
  "avatar-delete",
  "avatar-sweep",
  "avatar-old",
];

beforeEach(clearRateLimits);
afterEach(() => deleteUsers(USERNAMES));

async function picture(): Promise<Uint8Array> {
  return new Uint8Array(
    await sharp({
      create: { width: 300, height: 300, channels: 3, background: "#8a6a3a" },
    })
      .png()
      .toBuffer(),
  );
}

async function userId(username: string): Promise<string> {
  await registerUser(username);
  const row = await db
    .selectFrom("user")
    .select("id")
    .where("username", "=", username)
    .executeTakeFirst();
  assert.ok(row);
  return row.id;
}

test("a picture is stored, and its bytes are on disk", async () => {
  const id = await userId("avatar-set");
  const result = await write(async (transaction) =>
    UserAvatarService.setAvatar(transaction, id, await picture(), {
      origin: "own_work",
      credit: null,
    }),
  );

  assert.equal(result.kind, "set");
  const avatar = await UserAvatarService.selectAvatar(id);
  assert.ok(avatar);
  assert.notEqual(await FileStore.read(avatar.fileId), undefined);
});

test("what is not a picture is refused before anything is written", async () => {
  const id = await userId("avatar-refused");
  const notAnImage = new TextEncoder().encode("not an image");

  // The refusal is `toAvatar`'s, and `setAvatar` returns on it before it names a file at all —
  // which is *why* a rejected upload can leave no bytes behind. Asserted here rather than by
  // counting the store, which the other test files write into while this one runs.
  assert.equal(await toAvatar(notAnImage), undefined);

  const result = await write((transaction) =>
    UserAvatarService.setAvatar(transaction, id, notAnImage, {
      origin: "own_work",
      credit: null,
    }),
  );

  assert.equal(result.kind, "not_an_image");
  assert.equal(await UserAvatarService.selectAvatar(id), undefined);
});

/** Replacing leaves the old file for the sweep — deleting it inline would break a restore. */
test("replacing a picture moves the row and leaves the old file", async () => {
  const id = await userId("avatar-replace");
  await write(async (transaction) =>
    UserAvatarService.setAvatar(transaction, id, await picture(), {
      origin: "own_work",
      credit: null,
    }),
  );
  const first = await UserAvatarService.selectAvatar(id);
  assert.ok(first);

  await write(async (transaction) =>
    UserAvatarService.setAvatar(transaction, id, await picture(), {
      origin: "licence",
      credit: "CC BY 4.0",
    }),
  );
  const second = await UserAvatarService.selectAvatar(id);
  assert.ok(second);

  assert.notEqual(second.fileId, first.fileId);
  assert.equal(second.origin, "licence");
  assert.equal(second.credit, "CC BY 4.0");
  assert.notEqual(await FileStore.read(first.fileId), undefined);
});

test("deleting removes the row and leaves the file to the sweep", async () => {
  const id = await userId("avatar-delete");
  await write(async (transaction) =>
    UserAvatarService.setAvatar(transaction, id, await picture(), {
      origin: "own_work",
      credit: null,
    }),
  );
  const avatar = await UserAvatarService.selectAvatar(id);
  assert.ok(avatar);

  assert.equal(await write((transaction) => UserAvatarService.deleteAvatar(transaction, id)), true);
  assert.equal(await UserAvatarService.selectAvatar(id), undefined);
  assert.notEqual(await FileStore.read(avatar.fileId), undefined);
});

/** A file younger than the grace period may be an upload whose row is not committed yet. */
test("the sweep spares a referenced file and a recent orphan", async () => {
  const id = await userId("avatar-sweep");
  await write(async (transaction) =>
    UserAvatarService.setAvatar(transaction, id, await picture(), {
      origin: "own_work",
      credit: null,
    }),
  );
  const avatar = await UserAvatarService.selectAvatar(id);
  assert.ok(avatar);

  const orphan = randomUUIDv7();
  await FileStore.write(orphan, await picture());

  await UserAvatarService.sweepUnreferencedFiles();

  assert.notEqual(await FileStore.read(avatar.fileId), undefined);
  assert.notEqual(await FileStore.read(orphan), undefined);

  await FileStore.remove(orphan);
});

/** The other half: an orphan older than the grace period does go. */
test("the sweep deletes an orphan past the grace period", async () => {
  const orphan = randomUUIDv7();
  await FileStore.write(orphan, await picture());

  // Backdated rather than waited for. The sweep reads the file's own mtime, so this is the only
  // way to test the branch that deletes.
  // `utime` takes seconds or a `Date`, so the instant is converted only at that boundary.
  const longAgo = Temporal.Now.instant().subtract({ hours: 30 * 24 });
  const seconds = longAgo.epochMilliseconds / 1000;
  await utimes(`./.file-storage/${orphan}`, seconds, seconds);

  const deleted = await UserAvatarService.sweepUnreferencedFiles();

  assert.equal(await FileStore.read(orphan), undefined);
  assert.equal(deleted >= 1, true);
});

/** A file the database still names is never deleted, however old it is. */
test("the sweep spares a referenced file whatever its age", async () => {
  const id = await userId("avatar-old");
  await write(async (transaction) =>
    UserAvatarService.setAvatar(transaction, id, await picture(), {
      origin: "own_work",
      credit: null,
    }),
  );
  const avatar = await UserAvatarService.selectAvatar(id);
  assert.ok(avatar);

  const longAgo = Temporal.Now.instant().subtract({ hours: 30 * 24 });
  const seconds = longAgo.epochMilliseconds / 1000;
  await utimes(`./.file-storage/${avatar.fileId}`, seconds, seconds);

  await UserAvatarService.sweepUnreferencedFiles();
  assert.notEqual(await FileStore.read(avatar.fileId), undefined);
});
