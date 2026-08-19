import { getRequiredEnvVariable } from "@/src/util/env.ts";
import { retry } from "@std/async/retry";

/**
 * Reads what the tests actually sent. A reset token is stored hashed, so the message is the
 * only place its plaintext exists and testing the flow means fetching the mail.
 *
 * Mailpit is in `docker-compose.yaml` beside Postgres and Redis; its web interface is on the
 * port after its SMTP one. Not named `*_test.ts`, so the runner does not collect it.
 */
const MAILPIT_URL = `http://${getRequiredEnvVariable("SMTP_HOST")}:8025`;

type MailpitMessage = {
  ID: string;
  From: { Address: string; Name: string };
  To: Array<{ Address: string }>;
  Subject: string;
};

export async function deleteAllMail(): Promise<void> {
  const response = await fetch(`${MAILPIT_URL}/api/v1/messages`, {
    method: "DELETE",
  });
  await response.body?.cancel();
}

async function listMail(): Promise<Array<MailpitMessage>> {
  const response = await fetch(`${MAILPIT_URL}/api/v1/messages`);
  const { messages } = await response.json() as { messages: MailpitMessage[] };
  return messages;
}

export async function countMail(): Promise<number> {
  return (await listMail()).length;
}

export type ReceivedMail = {
  from: string;
  to: string;
  subject: string;
  text: string;
};

/** Polls: `flushBackgroundWork` settles the send, but Mailpit still has to index it. */
export async function waitForMail(address: string): Promise<ReceivedMail> {
  return await retry(async () => {
    const message = (await listMail())
      .find((it) => it.To.some((to) => to.Address === address));

    if (message === undefined) {
      throw new Error(`no mail for ${address} yet`);
    }

    const response = await fetch(`${MAILPIT_URL}/api/v1/message/${message.ID}`);
    const { Text } = await response.json() as { Text: string };

    return {
      from: message.From.Address,
      to: address,
      subject: message.Subject,
      text: Text,
    };
  }, { minTimeout: 20, maxAttempts: 8 });
}

/** The link is the only URL in these messages, so this cannot pick up the wrong one. */
export function tokenFromMail(mail: ReceivedMail): string {
  const link = mail.text.match(/https?:\/\/\S+/)?.[0];

  if (link === undefined) {
    throw new Error(`no link in the message:\n${mail.text}`);
  }

  const token = new URL(link).searchParams.get("token");

  if (token === null) {
    throw new Error(`link carries no token: ${link}`);
  }

  return token;
}
