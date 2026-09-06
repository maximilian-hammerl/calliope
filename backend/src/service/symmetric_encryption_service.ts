import * as z from 'zod'
import { decodeBase64, encodeBase64 } from '@std/encoding'

// We need a strong symmetric encryption algorithm to encrypt the config. AES is fast, inexpensive, secure and widely
// used. Additionally, GCM includes checks that the ciphertext has not been modified by an attacker.
const ENCRYPTION_ALGORITHM = 'AES-GCM'

// Internal versioning
const ENCRYPTION_ALGORITHM_VERSION = 1

// For AES-GCM 256 bits, so 32 bytes are recommended
const MASTER_KEY_BYTE_LENGTH = 32

// For AES-GCM 96 bits, so 12 bytes are recommended
const INITIALIZATION_VECTOR_BYTE_LENGTH = 12

// How often can a message be safely encrypted? With 96‑bit random IVs, safely into the billions per key from a
// collision‑probability standpoint, but in practice set a much lower cap as above for operational safety.

// When to rotate the key? On a fixed schedule (e.g., every 90 days) and/or when a volume threshold is reached
// (e.g., 10–100 million encryptions), and immediately on security events.
export class SymmetricEncryptionService {
    private readonly ENVELOPE_SCHEMA: z.ZodObject<{
        v: z.ZodLiteral<typeof ENCRYPTION_ALGORITHM_VERSION>
        alg: z.ZodLiteral<typeof ENCRYPTION_ALGORITHM>
        kid: z.ZodLiteral<string>
        iv: z.ZodString
        ct: z.ZodString
    }>
    private cryptoKey: CryptoKey | null = null

    constructor(
        // Key for encryption
        private readonly key: string,
        // Unique identifier which key was used for encryption
        private readonly keyId: string,
    ) {
        if (!key) {
            throw new Error('Key is required')
        }
        if (!keyId) {
            throw new Error('Key ID is required')
        }

        this.ENVELOPE_SCHEMA = z.object({
            v: z.literal(ENCRYPTION_ALGORITHM_VERSION),
            alg: z.literal(ENCRYPTION_ALGORITHM),
            kid: z.literal(keyId),
            iv: z.string(),
            ct: z.string(),
            aad: z.string().optional(),
        })
    }

    private async getKey(): Promise<CryptoKey> {
        if (this.cryptoKey !== null) {
            return this.cryptoKey
        }

        if (!this.key) {
            throw new Error('Key is required')
        }

        const rawKey = encodeText(this.key)

        if (rawKey.byteLength !== MASTER_KEY_BYTE_LENGTH) {
            throw new Error(`Key must be the correct length, expected ${MASTER_KEY_BYTE_LENGTH} !== actual ${rawKey.byteLength}`)
        }

        this.cryptoKey = await crypto.subtle.importKey('raw', rawKey, ENCRYPTION_ALGORITHM, false, [
            'encrypt',
            'decrypt',
        ])
        return this.cryptoKey
    }

    // Initialization vector (IV)
    private getInitializationVector(): Uint8Array<ArrayBuffer> {
        return crypto.getRandomValues(new Uint8Array(INITIALIZATION_VECTOR_BYTE_LENGTH))
    }

    // Additional authenticated data (AAD)
    private buildAdditionalAuthenticatedData(data: object): string {
        return JSON.stringify(data)
    }

    public async encrypt(
        messageToEncrypt: string,
        authenticatedData?: object,
    ): Promise<z.infer<typeof this.ENVELOPE_SCHEMA>> {
        // The iv must never be reused with a given key
        const initializationVector = this.getInitializationVector()

        const encrypted = await crypto.subtle.encrypt(
            {
                name: ENCRYPTION_ALGORITHM,
                iv: initializationVector,
                additionalData: authenticatedData
                    ? encodeText(this.buildAdditionalAuthenticatedData(authenticatedData))
                    : undefined,
            },
            await this.getKey(),
            encodeText(messageToEncrypt),
        )

        return {
            v: ENCRYPTION_ALGORITHM_VERSION,
            alg: ENCRYPTION_ALGORITHM,
            kid: this.keyId,
            iv: encodeBase64(initializationVector),
            ct: encodeBase64(encrypted),
        }
    }

    public async decrypt(
        unvalidatedEnvelope: unknown,
        authenticatedData?: object,
    ): Promise<string> {
        const envelope = this.ENVELOPE_SCHEMA.parse(unvalidatedEnvelope)

        const initializationVector = decodeBase64(envelope.iv)
        const encrypted = decodeBase64(envelope.ct)

        const decrypted = await crypto.subtle.decrypt(
            {
                name: ENCRYPTION_ALGORITHM,
                iv: initializationVector,
                additionalData: authenticatedData
                    ? encodeText(this.buildAdditionalAuthenticatedData(authenticatedData))
                    : undefined,
            },
            await this.getKey(),
            encrypted,
        )
        return decodeText(decrypted)
    }
}

function encodeText(text: string): BufferSource {
    const encoder = new TextEncoder()
    return encoder.encode(text)
}

function decodeText(buffer: BufferSource): string {
    const decoder = new TextDecoder()
    return decoder.decode(buffer)
}
