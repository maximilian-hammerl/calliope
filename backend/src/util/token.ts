import { randomBytes } from "node:crypto";
import * as z from "zod";
import { Buffer } from "node:buffer";

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

/**
 * A token travels as `id.secret`: the id finds the row by primary key, the secret is then
 * compared against the stored hash. A dot cannot occur in either half — a uuid is hex and
 * hyphens, a secret is base64url — and it is the one separator a URL leaves unescaped.
 */
const TOKEN_ID = z.uuidv7();

export function formatToken(id: string, secret: string): string {
  return `${id}.${secret}`;
}

/**
 * Undefined for anything that is not both halves. The id reaches a uuid column, where a
 * malformed one is a database error rather than a miss — a corrupted session cookie used to
 * answer 500 on every request instead of simply not being signed in.
 */
export function parseToken(
  token: string,
): { id: string; secret: string } | undefined {
  const [id, secret] = token.split(".");
  const parsedId = TOKEN_ID.safeParse(id);

  if (!parsedId.success || !secret) {
    return undefined;
  }

  // The parsed value rather than the raw one, so what is returned is what was checked.
  return { id: parsedId.data, secret };
}
