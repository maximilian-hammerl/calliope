import { assertEquals, assertRejects } from "@std/assert";
import { generate as uuidv7 } from "@std/uuid/v7";
import { FileStore } from "./file_store.ts";

const BYTES = new TextEncoder().encode("some bytes");

function fileId(): string {
  return uuidv7();
}

Deno.test("what is written is what is read", async () => {
  const id = fileId();
  await FileStore.write(id, BYTES);
  assertEquals(await FileStore.read(id), BYTES);
  await FileStore.remove(id);
});

Deno.test("an absent file reads as undefined rather than throwing", async () => {
  assertEquals(await FileStore.read(fileId()), undefined);
});

/** The sweep and a member's own delete race, and both want the same end state. */
Deno.test("removing what is not there is success", async () => {
  await FileStore.remove(fileId());
});

Deno.test("a written file is listed, and a removed one is not", async () => {
  const id = fileId();
  await FileStore.write(id, BYTES);
  assertEquals((await FileStore.listFileIds()).includes(id), true);

  await FileStore.remove(id);
  assertEquals((await FileStore.listFileIds()).includes(id), false);
});

/**
 * The column is already `uuid`, so this is the second lock. It is here because the store is what
 * turns a value into a path, and a path is where an escape would happen.
 */
Deno.test("a name that is not a file id never becomes a path", async () => {
  for (
    const name of [
      "../../etc/passwd",
      "..",
      "a/b",
      "",
      "01a00000-0000-7000-8000",
      // a v4 uuid: the column and the store both mean v7
      "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    ]
  ) {
    // deno-lint-ignore no-await-in-loop -- sequential on purpose, one case per iteration
    await assertRejects(() => FileStore.read(name));
    // deno-lint-ignore no-await-in-loop -- sequential on purpose, one case per iteration
    await assertRejects(() => FileStore.write(name, BYTES));
    // deno-lint-ignore no-await-in-loop -- sequential on purpose, one case per iteration
    await assertRejects(() => FileStore.remove(name));
  }
});

/** A crash mid-write must not leave half a file under a name the database already points at. */
Deno.test("a partial write is not listed as a file", async () => {
  const id = fileId();
  await Deno.mkdir("./.file-storage", { recursive: true });
  await Deno.writeFile(`./.file-storage/${id}.partial`, BYTES);

  assertEquals(
    (await FileStore.listFileIds()).includes(`${id}.partial`),
    false,
  );
  assertEquals((await FileStore.listFileIds()).includes(id), false);

  await Deno.remove(`./.file-storage/${id}.partial`);
});
