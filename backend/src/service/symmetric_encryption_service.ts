import * as z from "zod";
import { decodeBase64, encodeBase64 } from "@std/encoding";

/** GCM rather than CBC: it authenticates the ciphertext, so a tampered value fails to decrypt. */
const ENCRYPTION_ALGORITHM = "AES-GCM";

/** In the envelope, so a later change of format can be told from this one on read. */
const ENVELOPE_VERSION = 1;

/** AES-256. */
const KEY_BYTE_LENGTH = 32;

/** What GCM is specified for. Random per message: an initialisation vector is never reused. */
const INITIALIZATION_VECTOR_BYTE_LENGTH = 12;

/**
 * `kid` is read rather than asserted. A value encrypted before a rotation has to stay readable
 * until it is spent, so decryption looks its key up instead of demanding the current one.
 */
const ENVELOPE_SCHEMA = z.object({
  v: z.literal(ENVELOPE_VERSION),
  alg: z.literal(ENCRYPTION_ALGORITHM),
  kid: z.string(),
  iv: z.string(),
  ct: z.string(),
});

export type Envelope = z.infer<typeof ENVELOPE_SCHEMA>;

export class SymmetricEncryptionService {
  /** The promise, not the key: two concurrent calls would otherwise both import it. */
  private readonly importedKeys = new Map<string, Promise<CryptoKey>>();

  /**
   * `keys` is every key that may still have to be read, by id; `currentKeyId` is the one new
   * values are written with. Rotating is adding a key, pointing this at it, and keeping the old
   * one until nothing encrypted with it is left.
   */
  constructor(
    private readonly currentKeyId: string,
    private readonly keys: Readonly<Record<string, string>>,
  ) {
    if (!currentKeyId) {
      throw new Error("A current key id is required");
    }

    if (keys[currentKeyId] === undefined) {
      throw new Error(
        `No key is configured for the current key id "${currentKeyId}"`,
      );
    }
  }

  public async encrypt(
    message: string,
    authenticatedData?: object,
  ): Promise<Envelope> {
    const initializationVector = crypto.getRandomValues(
      new Uint8Array(INITIALIZATION_VECTOR_BYTE_LENGTH),
    );

    const encrypted = await crypto.subtle.encrypt(
      {
        name: ENCRYPTION_ALGORITHM,
        iv: initializationVector,
        additionalData: encodeAuthenticatedData(authenticatedData),
      },
      await this.getKey(this.currentKeyId),
      encodeText(message),
    );

    return {
      v: ENVELOPE_VERSION,
      alg: ENCRYPTION_ALGORITHM,
      kid: this.currentKeyId,
      iv: encodeBase64(initializationVector),
      ct: encodeBase64(encrypted),
    };
  }

  /** Throws on a tampered value, an unknown key and mismatched authenticated data alike. */
  public async decrypt(
    unvalidatedEnvelope: unknown,
    authenticatedData?: object,
  ): Promise<string> {
    const envelope = ENVELOPE_SCHEMA.parse(unvalidatedEnvelope);

    const decrypted = await crypto.subtle.decrypt(
      {
        name: ENCRYPTION_ALGORITHM,
        iv: decodeBase64Bytes(envelope.iv),
        additionalData: encodeAuthenticatedData(authenticatedData),
      },
      await this.getKey(envelope.kid),
      decodeBase64Bytes(envelope.ct),
    );

    return decodeText(decrypted);
  }

  private getKey(keyId: string): Promise<CryptoKey> {
    const imported = this.importedKeys.get(keyId);

    if (imported !== undefined) {
      return imported;
    }

    const key = this.keys[keyId];

    if (key === undefined) {
      throw new Error(`No key is configured for key id "${keyId}"`);
    }

    const importing = importKey(keyId, key);
    this.importedKeys.set(keyId, importing);
    return importing;
  }
}

/**
 * Base64 rather than the characters themselves, so a key can be 32 random bytes:
 * `openssl rand -base64 32`. Named by id in every message — never the key itself.
 */
async function importKey(keyId: string, key: string): Promise<CryptoKey> {
  let rawKey: Uint8Array<ArrayBuffer>;

  try {
    rawKey = decodeBase64Bytes(key);
  } catch {
    throw new Error(`The key "${keyId}" is not base64`);
  }

  if (rawKey.byteLength !== KEY_BYTE_LENGTH) {
    throw new Error(
      `The key "${keyId}" decodes to ${rawKey.byteLength} bytes rather than ${KEY_BYTE_LENGTH}; ` +
        "generate one with `openssl rand -base64 32`",
    );
  }

  return await crypto.subtle.importKey(
    "raw",
    rawKey,
    ENCRYPTION_ALGORITHM,
    false,
    [
      "encrypt",
      "decrypt",
    ],
  );
}

/**
 * Never stored: the caller rebuilds it on decryption, which is what binds a ciphertext to its
 * context. Key order is part of the bytes, so both sides have to build the object the same way.
 */
function encodeAuthenticatedData(
  data: object | undefined,
): BufferSource | undefined {
  return data === undefined ? undefined : encodeText(JSON.stringify(data));
}

/** Copied: WebCrypto refuses the `ArrayBufferLike` that decoding returns, which may be shared. */
function decodeBase64Bytes(value: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(decodeBase64(value));
}

function encodeText(text: string): BufferSource {
  return new TextEncoder().encode(text);
}

function decodeText(buffer: BufferSource): string {
  return new TextDecoder().decode(buffer);
}
