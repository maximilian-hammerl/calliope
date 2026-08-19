import { assert, assertEquals, assertNotEquals } from "@std/assert";
import { generateToken, hashToken } from "@/src/util/token.ts";

Deno.test("every token is different", async () => {
  const tokens = new Set(
    await Promise.all(
      Array.from({ length: 100 }, () => generateToken()),
    ),
  );
  assertEquals(tokens.size, 100);
});

Deno.test("a token is 256 bits, url-safe", () => {
  const token = generateToken();
  // base64url of 32 bytes, without padding.
  assertEquals(token.length, 43);
  assert(/^[A-Za-z0-9_-]+$/.test(token), token);
});

Deno.test("hashing is deterministic and matches SHA-256", async () => {
  // The value pgcrypto's digest(…, 'sha256') produced for the same input, so what is stored
  // has not changed shape by moving the hashing out of the database.
  const hash = await hashToken("abc");
  assertEquals(
    Buffer.from(hash).toString("hex"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
  assertEquals(hash.length, 32);
});

Deno.test("different tokens hash differently", async () => {
  assertNotEquals(
    Buffer.from(await hashToken(generateToken())).toString("hex"),
    Buffer.from(await hashToken(generateToken())).toString("hex"),
  );
});
