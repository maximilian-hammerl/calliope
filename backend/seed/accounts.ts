import { userId } from "@/seed/ids.ts";
import type { ProfileColumn } from "@/src/service/user_service.ts";

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

/**
 * Platform roles, so the operator surfaces can be worked on without granting a role by hand
 * every time the database is rebuilt. Two accounts, one of each, because the difference
 * between them is the thing worth being able to see.
 */
export const PLATFORM_ROLES = {
  federkiel: "administrator",
  kommafehler: "moderator",
} as const satisfies Partial<Record<keyof typeof USER, string>>;

/**
 * Two of the nine, so the page can be seen filled, half-filled and empty. Most members answer
 * nothing, and a fixture where everybody answered everything would never show that.
 */
export const PROFILES = {
  tintenfleck: {
    aboutMe:
      "Schreibe seit ungefähr zehn Jahren, meistens abends und fast immer zu lang.\n\nAm liebsten Geschichten, in denen wenig passiert und trotzdem alles kippt.",
    writingStyle:
      "Dritte Person, begrenzt, Vergangenheit. Viel Dialog, wenig Beschreibung.",
    postLength:
      "Zwei bis vier Absätze. Wenn eine Szene trägt, auch mal doppelt so viel.",
    writingFrequency:
      "Zwei- bis dreimal pro Woche, abends. Am Wochenende meistens gar nicht.",
    coWriterExpectations:
      "Sag mir, wenn dir etwas nicht passt, statt langsamer zu antworten. Tempo ist mir weniger wichtig als Verlässlichkeit.",
    writingBoundaries:
      "Nichts Explizites, keine sexualisierte Gewalt. Gewalt sonst gerne, wenn sie etwas erzählt.",
    genres:
      "Historisch, Mystery, alles Leise. Fantasy nur, wenn die Regeln stimmen.",
  },
  nachtschreiber: {
    writingStyle: "Erste Person, Gegenwart. Ich schreibe nah an einer Figur.",
    postLength: "Kurz, drei bis fünf Sätze. Dafür oft.",
    writingFrequency: "Fast täglich, meistens nachts.",
  },
} as const satisfies Partial<
  Record<keyof typeof USER, Partial<Record<ProfileColumn, string>>>
>;

/** Everyone but `unverified`, whose address is deliberately left unconfirmed. */
export const VERIFIED_USERNAMES =
  (Object.keys(USER) as Array<keyof typeof USER>)
    .filter((name) => name !== "unverified");
