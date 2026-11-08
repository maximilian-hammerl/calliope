import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUIDv7 } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { FileStore } from "./file_store.ts";

const BYTES = new TextEncoder().encode("some bytes");

function fileId(): string {
  return randomUUIDv7();
}

test("what is written is what is read", async () => {
  const id = fileId();
  await FileStore.write(id, BYTES);
  assert.deepEqual(await FileStore.read(id), BYTES);
  await FileStore.remove(id);
});

test("an absent file reads as undefined rather than throwing", async () => {
  assert.equal(await FileStore.read(fileId()), undefined);
});

/** The sweep and a member's own delete race, and both want the same end state. */
test("removing what is not there is success", async () => {
  await FileStore.remove(fileId());
});

test("a written file is listed, and a removed one is not", async () => {
  const id = fileId();
  await FileStore.write(id, BYTES);
  assert.equal((await FileStore.listFileIds()).includes(id), true);

  await FileStore.remove(id);
  assert.equal((await FileStore.listFileIds()).includes(id), false);
});

/**
 * The column is already `uuid`, so this is the second lock. It is here because the store is what
 * turns a value into a path, and a path is where an escape would happen.
 */
test("a name that is not a file id never becomes a path", async () => {
  for (const name of [
    "../../etc/passwd",
    "..",
    "a/b",
    "",
    "01a00000-0000-7000-8000",
    // a v4 uuid: the column and the store both mean v7
    "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  ]) {
    // oxlint-disable-next-line no-await-in-loop -- sequential on purpose, one case per iteration
    await assert.rejects(() => FileStore.read(name));
    // oxlint-disable-next-line no-await-in-loop -- sequential on purpose, one case per iteration
    await assert.rejects(() => FileStore.write(name, BYTES));
    // oxlint-disable-next-line no-await-in-loop -- sequential on purpose, one case per iteration
    await assert.rejects(() => FileStore.remove(name));
  }
});

/** A crash mid-write must not leave half a file under a name the database already points at. */
test("a partial write is not listed as a file", async () => {
  const id = fileId();
  await mkdir("./.file-storage", { recursive: true });
  await writeFile(`./.file-storage/${id}.partial`, BYTES);

  assert.equal((await FileStore.listFileIds()).includes(`${id}.partial`), false);
  assert.equal((await FileStore.listFileIds()).includes(id), false);

  await rm(`./.file-storage/${id}.partial`);
});
