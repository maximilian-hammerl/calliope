import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";

/**
 * Password hashing, in the application rather than in the database. pgcrypto's `crypt()`
 * meant the plaintext travelled to Postgres and lived in its memory, where statement logging
 * could capture it, and it put the hashing cost on the database. Here it never leaves this
 * process.
 *
 * scrypt comes with Deno through `node:crypto`, so there is no dependency and nothing to
 * build for the server's architecture, and unlike PBKDF2 it is memory-hard.
 */
const ALGORITHM = "scrypt";

/** CPU and memory cost. Raising it slows every sign-in and registration by design. */
const COST = 2 ** 15;
const BLOCK_SIZE = 8;
const PARALLELISATION = 1;

const KEY_LENGTH = 32;
const SALT_LENGTH = 16;

/**
 * scrypt needs about `128 * cost * blockSize` bytes, which is above Node's 32 MiB default,
 * so the limit is stated rather than left to trip over.
 */
const MAX_MEMORY = 2 * 128 * COST * BLOCK_SIZE;

type Parameters = {
  cost: number;
  blockSize: number;
  parallelisation: number;
};

const CURRENT: Parameters = {
  cost: COST,
  blockSize: BLOCK_SIZE,
  parallelisation: PARALLELISATION,
};

function derive(
  password: string,
  salt: Uint8Array,
  parameters: Parameters,
  keyLength: number,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      keyLength,
      {
        N: parameters.cost,
        r: parameters.blockSize,
        p: parameters.parallelisation,
        maxmem: MAX_MEMORY,
      },
      (error, key) => error ? reject(error) : resolve(key),
    );
  });
}

/**
 * Returns `scrypt$cost$blockSize$parallelisation$salt$hash`, base64 for the two binary
 * parts. The parameters travel with the hash so the cost can be raised later without
 * invalidating what is already stored — a hash written today keeps verifying against the
 * values it was written with.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await derive(password, salt, CURRENT, KEY_LENGTH);

  return [
    ALGORITHM,
    CURRENT.cost,
    CURRENT.blockSize,
    CURRENT.parallelisation,
    Buffer.from(salt).toString("base64"),
    Buffer.from(key).toString("base64"),
  ].join("$");
}

/** Never throws on a malformed or foreign hash: an unreadable record simply does not match. */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  const [algorithm, cost, blockSize, parallelisation, salt, hash] = parts;

  // The length check is what makes the five below defined, but indexing a string[] cannot
  // say so, hence each one again.
  if (
    parts.length !== 6 ||
    algorithm !== ALGORITHM ||
    cost === undefined ||
    blockSize === undefined ||
    parallelisation === undefined ||
    salt === undefined ||
    hash === undefined
  ) {
    return false;
  }
  const parameters = {
    cost: Number(cost),
    blockSize: Number(blockSize),
    parallelisation: Number(parallelisation),
  };
  if (!Object.values(parameters).every(Number.isSafeInteger)) {
    return false;
  }

  const expected = Buffer.from(hash, "base64");
  let actual: Uint8Array;
  try {
    actual = await derive(
      password,
      Buffer.from(salt, "base64"),
      parameters,
      expected.length,
    );
  } catch {
    // Parameters that scrypt refuses, for example a cost that is not a power of two.
    return false;
  }

  // Lengths are equal by construction above, but timingSafeEqual throws when they are not.
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
