import { TEXT_LIMIT } from "@/src/text_limit.ts";

/**
 * "Storyidee: {title}" — the kind is part of the name so the chat list says what the
 * conversation is about. Cut to the chat limit: an idea's title alone may be half again as long.
 */
export function conversationTitle(kind: string, title: string): string {
  return `${kind}: ${title}`.slice(0, TEXT_LIMIT.chatTitle);
}
