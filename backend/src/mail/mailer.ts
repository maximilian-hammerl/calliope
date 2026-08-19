// @ts-types="@types/nodemailer"
import nodemailer from "nodemailer";
import { APP_NAME } from "@/src/branding.ts";
import {
  getOptionalEnvVariable,
  getRequiredEnvVariable,
} from "@/src/util/env.ts";
import { runInBackground } from "@/src/util/background.ts";

/** Read at startup, so a misconfigured deployment fails then rather than on the first send. */
const SMTP_HOST = getRequiredEnvVariable("SMTP_HOST");
const SMTP_PORT = Number(getRequiredEnvVariable("SMTP_PORT"));
const SMTP_SECURE = getRequiredEnvVariable("SMTP_SECURE") === "true";
const SMTP_USERNAME = getOptionalEnvVariable("SMTP_USERNAME");
const SMTP_PASSWORD = getOptionalEnvVariable("SMTP_PASSWORD");
const MAIL_FROM_ADDRESS = getRequiredEnvVariable("MAIL_FROM_ADDRESS");

if (!Number.isInteger(SMTP_PORT) || SMTP_PORT <= 0) {
  throw new Error(`SMTP_PORT is not a port number: ${SMTP_PORT}`);
}

const transport = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  // Implicit TLS, as port 465 expects; false negotiates STARTTLS, which is what 587 wants.
  secure: SMTP_SECURE,
  // Mailpit wants no credentials, so an absent username is the development default rather
  // than a misconfiguration.
  auth: SMTP_USERNAME === undefined
    ? undefined
    : { user: SMTP_USERNAME, pass: SMTP_PASSWORD },
  // Reuses the connection: opening one measured thirty seconds against the production relay.
  pool: true,
});

export type Mail = {
  to: string;
  subject: string;
  text: string;
};

/**
 * The address must be one the SMTP account may send as, or DKIM will not align with this
 * header and the mail lands in spam. The display name follows `branding.ts`.
 */
async function send(mail: Mail): Promise<void> {
  await transport.sendMail({
    from: { name: APP_NAME, address: MAIL_FROM_ADDRESS },
    to: mail.to,
    subject: mail.subject,
    text: mail.text,
  });
}

/** Never awaited by a handler; see `util/background.ts`. Failures are only logged. */
function sendInBackground(mail: Mail): void {
  runInBackground(`Sending "${mail.subject}" to ${mail.to}`, () => send(mail));
}

export const Mailer = {
  send,
  sendInBackground,
};
