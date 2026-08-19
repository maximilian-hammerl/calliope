import { assert, assertEquals, assertNotEquals } from "@std/assert";
import {
  formatToken,
  generateToken,
  hashToken,
  parseToken,
} from "@/src/util/token.ts";
import { Buffer } from "node:buffer";

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

Deno.test("a formatted token parses back to its two halves", () => {
  const id = "01a019ee-ab02-7a82-9796-3767b50ed584";
  const secret = generateToken();

  assertEquals(parseToken(formatToken(id, secret)), { id, secret });
});

Deno.test("a secret never contains the separator", () => {
  // What makes splitting on a dot unambiguous: base64url has no dot in its alphabet.
  const secrets = Array.from({ length: 200 }, () => generateToken());
  assert(
    secrets.every((secret) => !secret.includes(".")),
    "a secret held a dot",
  );
});

Deno.test("anything that is not both halves does not parse", () => {
  for (
    const token of [
      "",
      "abc",
      "abc.def",
      ".only-a-secret",
      // A valid uuid, but nothing after the separator.
      "01a019ee-ab02-7a82-9796-3767b50ed584",
      "01a019ee-ab02-7a82-9796-3767b50ed584.",
      // A v4 uuid: the columns default to uuidv7, so this can never name a row.
      "f7a3b1c2-9d4e-4f6a-8b2c-1e3d5f7a9b1c.secret",
    ]
  ) {
    assertEquals(
      parseToken(token),
      undefined,
      `expected ${token} not to parse`,
    );
  }
});
