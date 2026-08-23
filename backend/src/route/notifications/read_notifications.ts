import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { NOTIFICATIONS_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { NotificationService } from "@/src/service/notification_service.ts";
import {
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  FORBIDDEN_RESPONSE,
  jsonContent,
} from "@/src/http/response.ts";

const READ_NOTIFICATIONS_RESPONSE = z.object({ read: z.number().int() });

export default new OpenAPIHono().openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: [NOTIFICATIONS_TAG],
    summary: "Mark every notification as read",
    description:
      "Opening the list is the act of having read it, so this marks all of the current user's unread notifications at once rather than one at a time.",
    operationId: "readNotifications",
    middleware: authenticated,
    responses: {
      [STATUS_CODE.OK]: {
        description: "How many were unread",
        content: jsonContent(READ_NOTIFICATIONS_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...FORBIDDEN_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const read = await NotificationService.markAllRead(c.get("user").id);

    return c.json({ read }, STATUS_CODE.OK);
  },
);
