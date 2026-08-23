import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { CHAT_MESSAGE_RESPONSE } from "@/src/http/response_schema.ts";
import { CHATS_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { ChatMessageService } from "@/src/service/chat_message_service.ts";
import {
  cursorQuerySchema,
  cursorResponseSchema,
} from "@/src/list/list_endpoint.ts";
import { checkJoinedChatMember } from "@/src/route/chats/chat/chat_membership.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  jsonContent,
} from "@/src/http/response.ts";
import { CHAT_GROUP_SCHEMA } from "@/src/database/schema.ts";

const CHAT_PARAMS = z.object({ chatId: CHAT_GROUP_SCHEMA.shape.id });

export default new OpenAPIHono().openapi(
  createRoute({
    method: "query",
    path: "/",
    tags: [CHATS_TAG],
    summary: "Read a chat's messages",
    description:
      "Returns a page of messages, newest first. Paged by cursor rather than offset: messages arrive while somebody reads, and an offset would repeat or skip whatever crossed the boundary.",
    operationId: "listMessages",
    middleware: authenticated,
    request: {
      params: CHAT_PARAMS,
      body: { required: true, content: jsonContent(cursorQuerySchema()) },
    },
    responses: {
      [STATUS_CODE.OK]: {
        description: "A page of messages",
        content: jsonContent(cursorResponseSchema(CHAT_MESSAGE_RESPONSE)),
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
    const user = c.get("user");

    const access = await checkJoinedChatMember(user, chatId);
    if (!access.allowed) {
      return access.reason === "not-found"
        ? c.json({ error: access.error }, STATUS_CODE.NotFound)
        : c.json({ error: access.error }, STATUS_CODE.Forbidden);
    }

    const page = await ChatMessageService.listMessages(
      chatId,
      c.req.valid("json"),
    );

    return c.json(page, STATUS_CODE.OK);
  },
);
