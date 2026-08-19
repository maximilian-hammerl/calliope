import type { Selectable } from "kysely";
import { db } from "@/src/database/client.ts";
import type { ChatMessage as DatabaseChatMessage } from "@/src/database/schema.ts";

export type ChatMessage =
  & Pick<
    Selectable<DatabaseChatMessage>,
    "id" | "chatGroupId" | "text" | "createdBy" | "createdAt"
  >
  // Null once the author's account is gone: what they wrote outlives it.
  & { createdByUsername: string | null };

const SELECTED_COLUMNS = [
  "chatMessage.id",
  "chatMessage.chatGroupId",
  "chatMessage.text",
  "chatMessage.createdBy",
  "chatMessage.createdAt",
] as const;

function messagesWithAuthor() {
  return db
    .selectFrom("chatMessage")
    .leftJoin("user", "user.id", "chatMessage.createdBy")
    .select([...SELECTED_COLUMNS, "user.username as createdByUsername"]);
}

/**
 * Newest first, paged by a cursor rather than an offset.
 *
 * Offset paging is wrong for a conversation: every message that arrives while somebody reads
 * shifts the window, so page two repeats or skips whatever moved across the boundary. The
 * cursor is a message id, and because they are uuidv7 — time-ordered — comparing ids orders
 * the conversation and the index on `(chat_group_id, id DESC)` serves both.
 */
async function listMessages(
  chatGroupId: string,
  { limit, before }: { limit: number; before?: string },
): Promise<{ results: Array<ChatMessage>; nextCursor: string | null }> {
  let messages = messagesWithAuthor()
    .where("chatMessage.chatGroupId", "=", chatGroupId)
    .orderBy("chatMessage.id", "desc")
    // One more than asked for, purely to know whether another page exists.
    .limit(limit + 1);

  if (before !== undefined) {
    messages = messages.where("chatMessage.id", "<", before);
  }

  const rows = await messages.execute();
  const results = rows.slice(0, limit);

  return {
    results,
    nextCursor: rows.length > limit ? results.at(-1)?.id ?? null : null,
  };
}

async function insertMessage(
  chatGroupId: string,
  text: string,
  createdBy: string,
): Promise<ChatMessage> {
  const { id } = await db
    .insertInto("chatMessage")
    .values({ chatGroupId, text, createdBy })
    .returning(["id"])
    .executeTakeFirstOrThrow();

  // Re-read rather than RETURNING, which cannot reach the joined author name.
  return await messagesWithAuthor()
    .where("chatMessage.id", "=", id)
    .executeTakeFirstOrThrow();
}

export const ChatMessageService = {
  listMessages,
  insertMessage,
};
