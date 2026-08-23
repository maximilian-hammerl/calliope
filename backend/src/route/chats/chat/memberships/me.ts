import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { CHAT_MEMBERSHIP_RESPONSE } from "@/src/http/response_schema.ts";
import { CHATS_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { UserInChatGroupService } from "@/src/service/user_in_chat_group_service.ts";
import {
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  FORBIDDEN_RESPONSE,
  jsonContent,
} from "@/src/http/response.ts";
import { CHAT_GROUP_SCHEMA } from "@/src/database/schema.ts";

const CHAT_PARAMS = z.object({ chatId: CHAT_GROUP_SCHEMA.shape.id });

const accept = new OpenAPIHono().openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: [CHATS_TAG],
    summary: "Accept an invitation to a chat",
    operationId: "acceptChatInvitation",
    middleware: authenticated,
    request: { params: CHAT_PARAMS },
    responses: {
      [STATUS_CODE.OK]: {
        description: "The membership",
        content: jsonContent(CHAT_MEMBERSHIP_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.NotFound]: {
        description: "No invitation to accept",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...FORBIDDEN_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { chatId } = c.req.valid("param");

    const membership = await UserInChatGroupService.acceptInvitation(
      chatId,
      c.get("user").id,
    );

    if (membership === undefined) {
      return c.json({ error: "Invitation not found" }, STATUS_CODE.NotFound);
    }

    return c.json(membership, STATUS_CODE.OK);
  },
);

const leave = new OpenAPIHono().openapi(
  createRoute({
    method: "delete",
    path: "/",
    tags: [CHATS_TAG],
    summary: "Leave a chat, or decline an invitation to one",
    description:
      "The same act either way. The last member out takes the chat and its messages with them.",
    operationId: "leaveChat",
    middleware: authenticated,
    request: { params: CHAT_PARAMS },
    responses: {
      [STATUS_CODE.OK]: {
        description: "Gone",
        content: jsonContent(z.object({ ok: z.literal(true) })),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.NotFound]: {
        description: "Not in that chat",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...FORBIDDEN_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { chatId } = c.req.valid("param");

    const left = await UserInChatGroupService.deleteMembership(
      chatId,
      c.get("user").id,
    );

    if (!left) {
      return c.json({ error: "Membership not found" }, STATUS_CODE.NotFound);
    }

    return c.json({ ok: true } as const, STATUS_CODE.OK);
  },
);

export default new OpenAPIHono()
  .route("/accept", accept)
  .route("/", leave);
