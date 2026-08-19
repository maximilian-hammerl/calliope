import { APP_NAME } from "@/src/branding.ts";
import type { Mail } from "@/src/mail/mailer.ts";

/** Text only, for the same reason as the reset mail: one copy of the words to keep in step. */
export function emailAddressVerificationMail(
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
    subject: `Bestätige deine E-Mail-Adresse für ${APP_NAME}`,
    text: `Hallo ${username},

bestätige mit diesem Link deine E-Mail-Adresse, damit du ${APP_NAME} nutzen kannst:

${link}

Der Link gilt ${validFor}. Ist er abgelaufen, kannst du dir jederzeit einen neuen schicken
lassen — melde dich dafür einfach an.

Hast du dich nicht bei ${APP_NAME} registriert, kannst du diese Nachricht ignorieren. Ohne
den Link oben passiert nichts, und die Adresse wird keinem Konto zugeordnet.

Viele Grüße
${APP_NAME}
`,
  };
}
