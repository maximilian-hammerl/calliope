import { APP_NAME } from "@/src/branding.ts";
import type { Mail } from "@/src/mail/mailer.ts";

/**
 * Nothing to click. Its whole job is that a password changed behind somebody's back does not
 * happen quietly — which is why it goes out even though the member just did it themselves.
 */
export function passwordChangedMail(
  { username, emailAddress }: { username: string; emailAddress: string },
): Mail {
  return {
    to: emailAddress,
    subject: `Dein Passwort bei ${APP_NAME} wurde geändert`,
    text: `Hallo ${username},

das Passwort deines Kontos wurde gerade geändert. Auf allen anderen Geräten wurdest du
abgemeldet.

Warst du das nicht, setz dein Passwort sofort über "Passwort vergessen" zurück — dann ist
der Zugang wieder allein bei dir.

Viele Grüße
${APP_NAME}
`,
  };
}
