import { APP_NAME } from "@/src/branding.ts";
import type { Mail } from "@/src/mail/mailer.ts";

/** Text only: an HTML part would be a second copy of the same three lines to keep in step. */
export function passwordResetMail(
  { username, emailAddress, link, lifetime }: {
    username: string;
    emailAddress: string;
    link: string;
    lifetime: Temporal.Duration;
  },
): Mail {
  const hours = lifetime.total({ unit: "hours" });
  const validFor = hours === 1 ? "eine Stunde" : `${hours} Stunden`;

  return {
    to: emailAddress,
    subject: `Neues Passwort für ${APP_NAME}`,
    text: `Hallo ${username},

für dein Konto wurde ein neues Passwort angefordert. Über diesen Link kannst du eines
vergeben:

${link}

Der Link gilt ${validFor} und lässt sich nur einmal verwenden. Sobald du ein neues Passwort
vergeben hast, wirst du auf allen Geräten abgemeldet.

Wenn du das nicht warst, musst du nichts tun: dein Passwort bleibt unverändert, und ohne den
Link oben kann niemand es ändern.

Viele Grüße
${APP_NAME}
`,
  };
}
