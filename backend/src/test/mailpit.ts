import { getOptionalEnvVariable, getRequiredEnvVariable } from "#/src/util/env.ts";
import { retry } from "#/src/util/async.ts";

/**
 * Reads what the tests actually sent. A reset token is stored hashed, so the message is the
 * only place its plaintext exists and testing the flow means fetching the mail.
 *
 * Mailpit is in `docker-compose.yaml` beside Postgres and Redis, on a port of its own so a
 * second checkout reads its own mailbox.
 */
const MAILPIT_URL = `http://${getRequiredEnvVariable("SMTP_HOST")}:${
  getOptionalEnvVariable("MAILPIT_PORT") ?? "8025"
}`;

type MailpitMessage = {
  ID: string;
  From: { Address: string; Name: string };
  To: Array<{ Address: string }>;
  Subject: string;
};

const addressedTo = (addresses: string[]) => (message: MailpitMessage) =>
  message.To.some((to) => addresses.includes(to.Address));

/** Only these recipients' messages: another test file may be waiting for the rest. */
export async function deleteMailFor(addresses: string[]): Promise<void> {
  const ids = (await listMail()).filter(addressedTo(addresses)).map((it) => it.ID);
  if (ids.length === 0) {
    return;
  }

  const response = await fetch(`${MAILPIT_URL}/api/v1/messages`, {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ IDs: ids }),
  });
  await response.body?.cancel();
}

/** Counting the whole mailbox says nothing once anything else is sending mail. */
export async function countMailFor(addresses: string[]): Promise<number> {
  return (await listMail()).filter(addressedTo(addresses)).length;
}

async function listMail(): Promise<Array<MailpitMessage>> {
  const response = await fetch(`${MAILPIT_URL}/api/v1/messages`);
  const { messages } = (await response.json()) as { messages: MailpitMessage[] };
  return messages;
}

export type ReceivedMail = {
  from: string;
  to: string;
  subject: string;
  text: string;
};

/** Polls: `flushBackgroundWork` settles the send, but Mailpit still has to index it. */
export async function waitForMail(address: string): Promise<ReceivedMail> {
  return await retry(
    async () => {
      const message = (await listMail()).find((it) => it.To.some((to) => to.Address === address));

      if (message === undefined) {
        throw new Error(`no mail for ${address} yet`);
      }

      const response = await fetch(`${MAILPIT_URL}/api/v1/message/${message.ID}`);
      const { Text } = (await response.json()) as { Text: string };

      return {
        from: message.From.Address,
        to: address,
        subject: message.Subject,
        text: Text,
      };
      // Doubling from 20ms over 8 attempts gave up after ~2.5s, which an idle machine never
      // needed and a loaded one — two test processes and a backend — regularly exceeded.
      // Capping the delay keeps it just as quick when the mail is already there.
    },
    { minTimeout: 20, maxTimeout: 500, maxAttempts: 20 },
  );
}

/** The link is the only URL in these messages, so this cannot pick up the wrong one. */
export function tokenFromMail(mail: ReceivedMail): string {
  const link = mail.text.match(/https?:\/\/\S+/u)?.[0];

  if (link === undefined) {
    throw new Error(`no link in the message:\n${mail.text}`);
  }

  const token = new URL(link).searchParams.get("token");

  if (token === null) {
    throw new Error(`link carries no token: ${link}`);
  }

  return token;
}
