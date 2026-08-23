import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { SESSION_RESPONSE } from "@/src/http/response_schema.ts";
import { AUTH_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { SessionCookieService } from "@/src/service/session_cookie_service.ts";
import { SESSION_LIFETIME, UserService } from "@/src/service/user_service.ts";
import { userAgentParts } from "@/src/util/user_agent_parts.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  FORBIDDEN_RESPONSE,
  jsonContent,
} from "@/src/http/response.ts";

export default new OpenAPIHono().openapi(
  createRoute({
    // No parameters at all, so a GET rather than a QUERY — like the two collection endpoints
    // that answer with everything they have.
    method: "get",
    path: "/",
    tags: [AUTH_TAG],
    summary: "List the member's own sessions",
    description:
      "Every session of the requesting member that has not expired, newest first, with the one asking marked. A session ends by itself 24 hours after its last use.",
    operationId: "listSessions",
    middleware: authenticated,
    responses: {
      [STATUS_CODE.OK]: {
        description: "The member's live sessions",
        content: jsonContent(z.object({ results: z.array(SESSION_RESPONSE) })),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...FORBIDDEN_RESPONSE,
      ...BAD_REQUEST_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const currentSessionId = SessionCookieService.getUserSession(c)?.id;
    const sessions = await UserService.selectSessionsForUser(c.get("user").id);

    return c.json({
      results: sessions.map((session) => ({
        id: session.id,
        // Parsed here, not stored: a label could only ever be in one language.
        ...userAgentParts(session.userAgent),
        ipAddress: session.ipAddress,
        createdAt: session.createdAt,
        // Derived, not stored: expiry is pushed to now plus the lifetime on use.
        lastUsedAt: Temporal.Instant.from(session.expiresAt)
          .subtract(SESSION_LIFETIME)
          .toString(),
        current: session.id === currentSessionId,
      })),
    }, STATUS_CODE.OK);
  },
);
