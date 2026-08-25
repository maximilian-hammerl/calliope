import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { listQuery } from "@/src/list/list_endpoint_query.ts";
import { CHAT_MEMBERSHIP_RESPONSE } from "@/src/http/response_schema.ts";
import { CHATS_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { UserInChatGroupService } from "@/src/service/user_in_chat_group_service.ts";
import { ChatGroupService } from "@/src/service/chat_group_service.ts";
import {
  listQuerySchema,
  listResponseSchema,
} from "@/src/list/list_endpoint.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  FORBIDDEN_RESPONSE,
  jsonContent,
} from "@/src/http/response.ts";
import {
  CHAT_GROUP_SCHEMA,
  USER_IN_CHAT_GROUP_SCHEMA,
} from "@/src/database/schema.ts";

const CHAT_PARAMS = z.object({ chatId: CHAT_GROUP_SCHEMA.shape.id });

// Public attribute names are mapped to qualified columns, so the API never exposes the
// schema, and only these values can ever reach `dynamic.ref`.
const SORT_ATTRIBUTE = USER_IN_CHAT_GROUP_SCHEMA
  .keyof()
  .extract(["joinedAt", "invitedAt", "status"])
  .default("invitedAt")
  .transform((attribute) => `userInChatGroup.${attribute}` as const);

const LIST_CHAT_MEMBERSHIPS_BODY = listQuerySchema(SORT_ATTRIBUTE, {}, "asc");

export default new OpenAPIHono().openapi(
  createRoute({
    method: "query",
    path: "/",
    tags: [CHATS_TAG],
    summary: "List who is in a chat",
    description:
      "Everyone in the chat, including those who have been invited and not yet accepted. Visible to anybody the chat is visible to — an invitation has to be able to see who it would be joining.",
    operationId: "listChatMemberships",
    middleware: authenticated,
    // Required, so that an absent body cannot skip validation and lose the defaults.
    request: {
      params: CHAT_PARAMS,
      body: {
        required: true,
        content: jsonContent(LIST_CHAT_MEMBERSHIPS_BODY),
      },
    },
    responses: {
      [STATUS_CODE.OK]: {
        description: "A page of members",
        content: jsonContent(listResponseSchema(CHAT_MEMBERSHIP_RESPONSE)),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.NotFound]: {
        description: "No such chat, or not one of the current user's",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...FORBIDDEN_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { chatId } = c.req.valid("param");

    // Only visibility, not membership: somebody deciding whether to accept needs to see who
    // else is there. Taking part is what `checkJoinedChatMember` guards.
    const chat = await ChatGroupService.selectChatGroup(c.get("user"), chatId);
    if (chat === undefined) {
      return c.json({ error: "Chat not found" }, STATUS_CODE.NotFound);
    }

    const page = await UserInChatGroupService.listMembers(
      chatId,
      listQuery(c.req.valid("json")),
    );

    return c.json(page, STATUS_CODE.OK);
  },
);
