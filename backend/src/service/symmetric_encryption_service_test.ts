import { assert, assertEquals, assertRejects, assertThrows } from "@std/assert";
import { encodeBase64 } from "@std/encoding";
import { SymmetricEncryptionService } from "@/src/service/symmetric_encryption_service.ts";

/** What `openssl rand -base64 32` produces, which is the only key shape the service takes. */
function randomKey(): string {
  return encodeBase64(crypto.getRandomValues(new Uint8Array(32)));
}

const MESSAGE = "https://calliope.example/reset-password?token=018f.secret";

Deno.test("a message survives the round trip", async () => {
  const key = randomKey();
  const service = new SymmetricEncryptionService("k", { k: key });

  const envelope = await service.encrypt(MESSAGE);

  assertEquals(await service.decrypt(envelope), MESSAGE);
});

Deno.test("the envelope carries no plaintext", async () => {
  const service = new SymmetricEncryptionService("k", { k: randomKey() });

  const envelope = await service.encrypt(MESSAGE);

  assert(!JSON.stringify(envelope).includes("reset-password"));
  assertEquals(envelope.kid, "k");
});

Deno.test("encrypting twice gives different ciphertext", async () => {
  const service = new SymmetricEncryptionService("k", { k: randomKey() });

  const [first, second] = await Promise.all([
    service.encrypt(MESSAGE),
    service.encrypt(MESSAGE),
  ]);

  // A reused initialisation vector would break GCM outright, so this is the property to hold.
  assert(first.iv !== second.iv);
  assert(first.ct !== second.ct);
});

Deno.test("a tampered ciphertext is refused rather than decrypted", async () => {
  const service = new SymmetricEncryptionService("k", { k: randomKey() });
  const envelope = await service.encrypt(MESSAGE);

  const tampered = { ...envelope, ct: `${envelope.ct.slice(0, -4)}AAAA` };

  await assertRejects(() => service.decrypt(tampered));
});

Deno.test("another key cannot read it", async () => {
  const written = new SymmetricEncryptionService("k", { k: randomKey() });
  const other = new SymmetricEncryptionService("k", { k: randomKey() });

  const envelope = await written.encrypt(MESSAGE);

  await assertRejects(() => other.decrypt(envelope));
});

Deno.test("an envelope that is not one is refused", async () => {
  const service = new SymmetricEncryptionService("k", { k: randomKey() });

  await assertRejects(() => service.decrypt({ ct: "nonsense" }));
  await assertRejects(() => service.decrypt(null));
});

Deno.test("a value encrypted before a rotation still decrypts after it", async () => {
  const oldKey = randomKey();
  const newKey = randomKey();

  const before = new SymmetricEncryptionService("2026-01", {
    "2026-01": oldKey,
  });
  const envelope = await before.encrypt(MESSAGE);

  // Rotating is adding the new key and pointing the current id at it; the old one stays until
  // nothing encrypted with it is left.
  const after = new SymmetricEncryptionService("2026-04", {
    "2026-04": newKey,
    "2026-01": oldKey,
  });

  assertEquals(await after.decrypt(envelope), MESSAGE);
  assertEquals((await after.encrypt(MESSAGE)).kid, "2026-04");
});

Deno.test("dropping a key that is still in use says which one", async () => {
  const service = new SymmetricEncryptionService("2026-01", {
    "2026-01": randomKey(),
  });
  const envelope = await service.encrypt(MESSAGE);

  const dropped = new SymmetricEncryptionService("2026-04", {
    "2026-04": randomKey(),
  });

  const error = await assertRejects(() => dropped.decrypt(envelope), Error);
  assert(error.message.includes("2026-01"), error.message);
});

Deno.test("authenticated data binds the ciphertext to its context", async () => {
  const service = new SymmetricEncryptionService("k", { k: randomKey() });
  const boundTo = { id: "0199a1b2-c3d4-7000-8000-000000000001" };

  const envelope = await service.encrypt(MESSAGE, boundTo);

  assertEquals(await service.decrypt(envelope, boundTo), MESSAGE);
  // Which is the whole point: the same ciphertext against another row is refused.
  await assertRejects(() =>
    service.decrypt(envelope, { id: "0199a1b2-c3d4-7000-8000-000000000002" })
  );
  await assertRejects(() => service.decrypt(envelope));
});

Deno.test("a key that is not 32 bytes is refused, without naming it", async () => {
  const service = new SymmetricEncryptionService("k", {
    k: encodeBase64("short"),
  });

  const error = await assertRejects(() => service.encrypt(MESSAGE), Error);
  assert(error.message.includes("5 bytes"), error.message);
  assert(!error.message.includes("short"), error.message);
});

Deno.test("a key that is not base64 is refused", async () => {
  const service = new SymmetricEncryptionService("k", {
    k: "not base64 at all!",
  });

  await assertRejects(() => service.encrypt(MESSAGE), Error, "is not base64");
});

Deno.test("a current key id with no key is refused at construction", () => {
  // At construction rather than on first use, so a misconfigured deployment fails at startup.
  assertThrows(
    () => new SymmetricEncryptionService("k", {}),
    Error,
    "current key id",
  );
  assertThrows(
    () => new SymmetricEncryptionService("", { k: randomKey() }),
    Error,
  );
});
