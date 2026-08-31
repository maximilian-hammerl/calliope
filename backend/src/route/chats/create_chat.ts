import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { notBlank } from "@/src/http/request_schema.ts";
import { CHAT_GROUP_RESPONSE } from "@/src/http/response_schema.ts";
import { CHATS_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { ChatGroupService } from "@/src/service/chat_group_service.ts";
import { TEXT_LIMIT } from "@/src/text_limit.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  FORBIDDEN_RESPONSE,
  jsonContent,
} from "@/src/http/response.ts";

const CREATE_CHAT_BODY = z.object({
  title: notBlank(z.string().min(1).max(TEXT_LIMIT.chatTitle)),
});

export default new OpenAPIHono().openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: [CHATS_TAG],
    summary: "Start a chat",
    description:
      "Creates a chat with the current user as its first member. Everybody else has to be invited and accept.",
    operationId: "createChat",
    middleware: authenticated,
    request: {
      body: { required: true, content: jsonContent(CREATE_CHAT_BODY) },
    },
    responses: {
      [STATUS_CODE.Created]: {
        description: "The new chat",
        content: jsonContent(CHAT_GROUP_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...FORBIDDEN_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { title } = c.req.valid("json");

    const chat = await ChatGroupService.insertChatGroup(c.get("user"), title);

    return c.json(chat, STATUS_CODE.Created);
  },
);
