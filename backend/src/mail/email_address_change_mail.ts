import { APP_NAME } from "@/src/branding.ts";
import type { Mail } from "@/src/mail/mailer.ts";

function validFor(lifetime: Temporal.Duration): string {
  const hours = lifetime.total({ unit: "hours" });
  return hours === 1 ? "eine Stunde" : `${hours} Stunden`;
}

/** To the address being moved *to*: opening this link is what applies the change. */
export function emailAddressChangeConfirmationMail(
  { username, newEmailAddress, link, lifetime }: {
    username: string;
    newEmailAddress: string;
    link: string;
    lifetime: Temporal.Duration;
  },
): Mail {
  return {
    to: newEmailAddress,
    subject: `Neue E-Mail-Adresse für ${APP_NAME} bestätigen`,
    text: `Hallo ${username},

diese Adresse soll künftig zu deinem Konto bei ${APP_NAME} gehören. Bestätige sie mit
diesem Link:

${link}

Der Link gilt ${
      validFor(lifetime)
    }. Bis du ihn öffnest, bleibt deine bisherige Adresse
unverändert in Kraft.

Hast du das nicht angefordert, kannst du diese Nachricht ignorieren.

Viele Grüße
${APP_NAME}
`,
  };
}

/**
 * To the address being moved *away from*, while the change is still pending. This is the
 * mail that matters if somebody else got hold of the password: it reaches the person who
 * still owns the account, and the link stops the change.
 */
export function emailAddressChangeRequestedMail(
  { username, currentEmailAddress, newEmailAddress, link, lifetime }: {
    username: string;
    currentEmailAddress: string;
    newEmailAddress: string;
    link: string;
    lifetime: Temporal.Duration;
  },
): Mail {
  return {
    to: currentEmailAddress,
    subject: `Änderung deiner E-Mail-Adresse bei ${APP_NAME}`,
    text: `Hallo ${username},

für dein Konto wurde ${newEmailAddress} als neue E-Mail-Adresse angefordert. Solange die
neue Adresse nicht bestätigt ist, bleibt diese hier in Kraft.

Warst du das nicht, dann brich die Änderung mit diesem Link ab:

${link}

Der Link gilt ${
      validFor(lifetime)
    }. Ändere danach bitte auch dein Passwort: wer die
Änderung angefordert hat, kannte es.

Warst du das, musst du hier nichts tun.

Viele Grüße
${APP_NAME}
`,
  };
}

/** To the old address once the change has gone through. Nothing to click — it is a record. */
export function emailAddressChangeCompletedMail(
  { username, previousEmailAddress, newEmailAddress }: {
    username: string;
    previousEmailAddress: string;
    newEmailAddress: string;
  },
): Mail {
  return {
    to: previousEmailAddress,
    subject: `Deine E-Mail-Adresse bei ${APP_NAME} wurde geändert`,
    text: `Hallo ${username},

dein Konto gehört jetzt zu ${newEmailAddress}. An diese Adresse hier gehen keine weiteren
Nachrichten.

Warst du das nicht, setz sofort dein Passwort zurück und melde dich bei uns — wer die
Änderung vorgenommen hat, kannte dein Passwort.

Viele Grüße
${APP_NAME}
`,
  };
}
