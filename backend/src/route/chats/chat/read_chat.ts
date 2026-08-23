import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { CHATS_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { ChatGroupService } from "@/src/service/chat_group_service.ts";
import { checkJoinedChatMember } from "@/src/route/chats/chat/chat_membership.ts";
import {
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  jsonContent,
} from "@/src/http/response.ts";
import { CHAT_GROUP_SCHEMA } from "@/src/database/schema.ts";

const CHAT_PARAMS = z.object({ chatId: CHAT_GROUP_SCHEMA.shape.id });

export default new OpenAPIHono().openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: [CHATS_TAG],
    summary: "Mark a chat as read up to now",
    description:
      "Everything already sent counts as read. Unread is a comparison against this moment, not a receipt per message.",
    operationId: "readChat",
    middleware: authenticated,
    request: { params: CHAT_PARAMS },
    responses: {
      [STATUS_CODE.OK]: {
        description: "Read",
        content: jsonContent(z.object({ ok: z.literal(true) })),
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

    await ChatGroupService.markRead(chatId, user.id);

    return c.json({ ok: true } as const, STATUS_CODE.OK);
  },
);
