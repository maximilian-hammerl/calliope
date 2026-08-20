import { APP_NAME } from "@/src/branding.ts";
import type { Mail } from "@/src/mail/mailer.ts";

function validFor(lifetime: Temporal.Duration): string {
  const hours = lifetime.total({ unit: "hours" });
  return hours === 1 ? "eine Stunde" : `${hours} Stunden`;
}

/** Opening this link is what deletes the account. Nothing has happened yet. */
export function accountDeletionConfirmationMail(
  { username, emailAddress, link, lifetime }: {
    username: string;
    emailAddress: string;
    link: string;
    lifetime: Temporal.Duration;
  },
): Mail {
  return {
    to: emailAddress,
    subject: `Konto bei ${APP_NAME} löschen`,
    text: `Hallo ${username},

du hast angefordert, dein Konto bei ${APP_NAME} zu löschen. Noch ist nichts passiert.

Mit diesem Link löschst du es endgültig:

${link}

Der Link gilt ${
      validFor(lifetime)
    }. Danach ist dein Konto weg, und wir können es nicht
zurückholen.

Was gelöscht wird: dein Konto, deine Mitgliedschaften, deine Einladungen, deine
Benachrichtigungen und deine Storyideen. Was bleibt: was du in Gruppen geschrieben hast. Es gehört zu
Geschichten, an denen andere weitergeschrieben haben, und steht künftig ohne deinen Namen
da.

Willst du dein Konto behalten, ignoriere diese Nachricht einfach. Warst du das nicht, ändere
bitte dein Passwort — wer die Löschung angefordert hat, kannte es.

Viele Grüße
${APP_NAME}
`,
  };
}

/**
 * The last thing this address hears from us, sent after the account is gone. A deletion
 * nobody asked for is worth telling somebody about, even when nothing can be undone.
 */
export function accountDeletionCompletedMail(
  { username, emailAddress }: { username: string; emailAddress: string },
): Mail {
  return {
    to: emailAddress,
    subject: `Dein Konto bei ${APP_NAME} ist gelöscht`,
    text: `Hallo ${username},

dein Konto bei ${APP_NAME} ist gelöscht. Der Name ${username} ist wieder frei, und diese
Adresse gehört zu keinem Konto mehr.

Was du in Gruppen geschrieben hast, steht weiterhin dort, ohne deinen Namen.

Willst du irgendwann zurück, kannst du dich jederzeit neu anmelden — an dein bisheriges
Konto kommen wir aber nicht mehr heran.

Viele Grüße
${APP_NAME}
`,
  };
}
