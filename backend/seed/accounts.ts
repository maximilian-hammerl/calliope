import { userId } from "@/seed/ids.ts";

/**
 * Handles rather than first names: members of a writing community pick a pen name far more
 * often than they sign with their own, and a fixture full of Vornamen made every screen read
 * like an address book.
 */
export const USER = {
  tintenfleck: userId(1),
  zeilensprung: userId(2),
  randnotiz: userId(3),
  silbenmeer: userId(4),
  unverified: userId(5),
  federkiel: userId(6),
  nachtschreiber: userId(7),
  kommafehler: userId(8),
  lesezeichen: userId(9),
} as const;

/** Everyone but `unverified`, whose address is deliberately left unconfirmed. */
export const VERIFIED_USERNAMES =
  (Object.keys(USER) as Array<keyof typeof USER>)
    .filter((name) => name !== "unverified");
