import { assert, assertEquals, assertNotEquals } from "@std/assert";
import { hashPassword, verifyPassword } from "@/src/util/password.ts";

const password = "ein-sicheres-passwort";

Deno.test("a hashed password verifies against itself", async () => {
  assert(await verifyPassword(password, await hashPassword(password)));
});

Deno.test("a wrong password does not verify", async () => {
  assertEquals(
    await verifyPassword("falsch", await hashPassword(password)),
    false,
  );
});

Deno.test("the same password hashes differently every time", async () => {
  // A random salt per hash, so equal passwords are not recognisable as equal in the table.
  assertNotEquals(await hashPassword(password), await hashPassword(password));
});

Deno.test("the stored parameters are used, not the current ones", async () => {
  // Written with cost 2^14 while the code now uses 2^15. Raising the cost must not lock
  // anyone out of an account whose hash predates the change.
  const olderHash =
    "scrypt$16384$8$1$qVHj0kOmYKZwdDIrhUB9wg==$PVpDanX6oM7XGW3l/K2tCDLFn0Xe4rlfbWgy6Ywlbdc=";

  assert(await verifyPassword("ein-altes-passwort", olderHash));
  assertEquals(await verifyPassword("falsch", olderHash), false);
});

Deno.test("a password longer than 72 bytes is not truncated", async () => {
  // bcrypt ignored everything past 72 bytes, so these two would have been the same secret.
  const base = "x".repeat(72);
  const stored = await hashPassword(`${base}erste-endung`);

  assertEquals(await verifyPassword(`${base}zweite-endung`, stored), false);
  assert(await verifyPassword(`${base}erste-endung`, stored));
});

Deno.test("an unreadable stored hash does not match and does not throw", async () => {
  // Including a bcrypt hash, which is what rows held before this change.
  for (
    const stored of [
      "",
      "nonsense",
      "$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyDD.9Rr53pC3W",
      "scrypt$0$8$1$c2FsdA==$aGFzaA==",
      "scrypt$not-a-number$8$1$c2FsdA==$aGFzaA==",
      "argon2$16384$8$1$c2FsdA==$aGFzaA==",
    ]
  ) {
    // deno-lint-ignore no-await-in-loop -- sequential on purpose, one case per iteration
    assertEquals(await verifyPassword(password, stored), false, stored);
  }
});
