import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { listQuery } from "@/src/list/list_endpoint_query.ts";
import { NOTIFICATION_RESPONSE } from "@/src/http/response_schema.ts";
import { NOTIFICATIONS_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { NotificationService } from "@/src/service/notification_service.ts";
import { BlockService } from "@/src/service/block_service.ts";
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
import { NOTIFICATION_SCHEMA } from "@/src/database/schema.ts";

// Public attribute names are mapped to qualified columns, so the API never exposes the
// schema, and only these values can ever reach `dynamic.ref`.
const SORT_ATTRIBUTE = NOTIFICATION_SCHEMA
  .keyof()
  .extract(["occurredAt"])
  .default("occurredAt")
  .transform((attribute) => `notification.${attribute}` as const);

const LIST_NOTIFICATIONS_BODY = listQuerySchema(SORT_ATTRIBUTE, {
  unreadOnly: z.boolean().default(false),
}, "desc");

export default new OpenAPIHono().openapi(
  createRoute({
    method: "query",
    path: "/",
    tags: [NOTIFICATIONS_TAG],
    summary: "List the current user's notifications",
    description:
      "Returns a page of what has happened to the current user, newest first. A notification only exists while its recipient belongs to the group it is about, so nothing here needs filtering by access.",
    operationId: "listNotifications",
    middleware: authenticated,
    // Required, so that an absent body cannot skip validation and lose the defaults.
    request: {
      body: { required: true, content: jsonContent(LIST_NOTIFICATIONS_BODY) },
    },
    responses: {
      [STATUS_CODE.OK]: {
        description: "A page of notifications",
        content: jsonContent(listResponseSchema(NOTIFICATION_RESPONSE)),
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
    const user = c.get("user");
    const page = await NotificationService.listNotifications(user.id, {
      ...listQuery(c.req.valid("json")),
      hiddenActorIds: await BlockService.selectBlockedIds(user.id),
    });

    return c.json(page, STATUS_CODE.OK);
  },
);
