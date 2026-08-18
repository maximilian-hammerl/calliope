import { ChatGroupService } from "@/src/service/chat_group_service.ts";
import { UserInChatGroupService } from "@/src/service/user_in_chat_group_service.ts";
import type { User } from "@/src/service/user_service.ts";

/**
 * The two checks every chat route makes, in the order the rest of the API uses: what the
 * member may *see* before what they may *do*. A chat they are not in is reported as missing
 * rather than forbidden, so its existence stays hidden.
 *
 * Returns a verdict rather than a `Response`: handing back a bare `Response` erases the route's
 * typed responses, and Hono then cannot check that a handler returns something the schema
 * actually declares.
 */
export type ChatAccess =
  | { allowed: true }
  | { allowed: false; reason: "not-found" | "not-joined"; error: string };

export async function checkJoinedChatMember(
  user: User,
  chatGroupId: string,
): Promise<ChatAccess> {
  const chat = await ChatGroupService.selectChatGroup(user, chatGroupId);
  if (chat === undefined) {
    return { allowed: false, reason: "not-found", error: "Chat not found" };
  }

  const membership = await UserInChatGroupService.selectMembership(
    chatGroupId,
    user.id,
  );
  if (membership?.status !== "joined") {
    // Seeing an invitation is not the same as being in the conversation.
    return {
      allowed: false,
      reason: "not-joined",
      error: "Accept the invitation before taking part",
    };
  }

  return { allowed: true };
}
