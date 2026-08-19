import { randomBytes } from "node:crypto";

/**
 * Session tokens and the tokens inside mailed links are both random secrets rather than
 * passwords, so neither needs a slow hash — the only job of hashing here is that a leaked
 * database hands over nothing usable.
 *
 * SHA-256 in the application rather than pgcrypto's `digest()`, so the token itself never
 * reaches the database. The stored bytes are identical either way.
 */
const TOKEN_BYTES = 32;

export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/** Returned as a Buffer because that is how the generated schema types the bytea column. */
export async function hashToken(token: string): Promise<Buffer> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return Buffer.from(digest);
}
