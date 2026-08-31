import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { notBlank } from "@/src/http/request_schema.ts";
import { CHAT_MESSAGE_RESPONSE } from "@/src/http/response_schema.ts";
import { CHATS_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { ChatGroupService } from "@/src/service/chat_group_service.ts";
import { ChatMessageService } from "@/src/service/chat_message_service.ts";
import { publishChatEvent } from "@/src/event/chat_events.ts";
import { checkJoinedChatMember } from "@/src/route/chats/chat/chat_membership.ts";
import { TEXT_LIMIT } from "@/src/text_limit.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  jsonContent,
} from "@/src/http/response.ts";
import { CHAT_GROUP_SCHEMA } from "@/src/database/schema.ts";

const CHAT_PARAMS = z.object({ chatId: CHAT_GROUP_SCHEMA.shape.id });

const CREATE_MESSAGE_BODY = z.object({
  text: notBlank(z.string().min(1).max(TEXT_LIMIT.messageText)),
});

export default new OpenAPIHono().openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: [CHATS_TAG],
    summary: "Send a message",
    operationId: "createMessage",
    middleware: authenticated,
    request: {
      params: CHAT_PARAMS,
      body: { required: true, content: jsonContent(CREATE_MESSAGE_BODY) },
    },
    responses: {
      [STATUS_CODE.Created]: {
        description: "The message as it was stored",
        content: jsonContent(CHAT_MESSAGE_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.Forbidden]: {
        description: "The invitation has not been accepted",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.NotFound]: {
        description: "No such chat, or not one of the current user's",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { chatId } = c.req.valid("param");
    const { text } = c.req.valid("json");
    const user = c.get("user");

    const access = await checkJoinedChatMember(user, chatId);
    if (!access.allowed) {
      return access.reason === "not-found"
        ? c.json({ error: access.error }, STATUS_CODE.NotFound)
        : c.json({ error: access.error }, STATUS_CODE.Forbidden);
    }

    const message = await ChatMessageService.insertMessage(
      chatId,
      text,
      user.id,
    );

    // After the write, never inside it: a stream that cannot be written to must not fail a
    // message that is already stored. The sender is left out — they have it in the response.
    const recipientIds = (await ChatGroupService.selectMemberIds(chatId))
      .filter((memberId) => memberId !== user.id);
    publishChatEvent(recipientIds, { chatGroupId: chatId, message });

    return c.json(message, STATUS_CODE.Created);
  },
);
