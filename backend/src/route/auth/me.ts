import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { AUTH_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import { USER_SCHEMA } from "@/src/database/schema.ts";
import requireSession from "@/src/middleware/require_session_allowing_unverified_email_address.ts";
import { NotificationService } from "@/src/service/notification_service.ts";
import {
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  jsonContent,
} from "@/src/http/response.ts";

const CURRENT_USER_RESPONSE = USER_SCHEMA
  .pick({
    id: true,
    username: true,
    emailAddress: true,
    emailAddressVerifiedAt: true,
  })
  .extend({
    // Carried here rather than on an endpoint of its own: the interface already asks who is
    // signed in on every page, and a second poll for one integer would be noise.
    unreadNotifications: z.number().int(),
  });

export default new OpenAPIHono().openapi(
  createRoute({
    method: "get",
    path: "/me",
    tags: [AUTH_TAG],
    summary: "Read the currently signed-in user",
    description:
      "Reports who the session cookie belongs to. The session cookie is httpOnly, so this is the only way for a client to find out whether it is signed in and as whom.",
    operationId: "getCurrentUser",
    middleware: requireSession,
    responses: {
      [STATUS_CODE.OK]: {
        description: "The signed-in user",
        content: jsonContent(CURRENT_USER_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const user = c.get("user");
    const unreadNotifications = await NotificationService.countUnread(user.id);

    return c.json({ ...user, unreadNotifications }, STATUS_CODE.OK);
  },
);
