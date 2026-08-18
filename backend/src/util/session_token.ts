import { randomBytes } from "node:crypto";

/**
 * A session token is a random secret, not a password, so it needs no slow hash — the only
 * job of hashing here is that a leaked database does not hand over usable sessions.
 *
 * SHA-256 in the application rather than pgcrypto's `digest()`, so the token itself never
 * reaches the database. The stored bytes are identical either way.
 */
const TOKEN_BYTES = 32;

export function generateSessionToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/** Returned as a Buffer because that is how the generated schema types the bytea column. */
export async function hashSessionToken(token: string): Promise<Buffer> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return Buffer.from(digest);
}
