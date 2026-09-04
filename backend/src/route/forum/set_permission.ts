import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { FORUM_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import {
  FORUM_PERMISSION_TARGET_TYPES,
  ForumService,
} from "@/src/service/forum_service.ts";
import { mayActInForum } from "@/src/service/forum_authorization.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  FORBIDDEN_RESPONSE,
  jsonContent,
  OK_RESPONSE,
} from "@/src/http/response.ts";
import { FORUM_PERMISSION_SCHEMA } from "@/src/database/schema.ts";

/**
 * One route for the three kinds that carry a permission, rather than a `/permission` under each.
 * The act is identical whatever it names — the argument that makes favouriting one pair of routes
 * over five kinds — and it reaches the client as one hook instead of three.
 */
const TARGET_PARAMS = z.object({
  targetType: z.enum(FORUM_PERMISSION_TARGET_TYPES),
  targetId: z.uuidv7(),
});

const SET_PERMISSION_BODY = z.object({
  memberPermission: FORUM_PERMISSION_SCHEMA,
});

export default new OpenAPIHono().openapi(
  createRoute({
    method: "put",
    path: "/",
    tags: [FORUM_TAG],
    summary:
      "Set what members may do with a folder, thread or page of the forum",
    description:
      "Operators only, since the forum has no administrators. This is the row's *own* setting: whatever is above it can still close it, and re-opening that folder restores what was set here. Setting a folder's takes its whole subtree with it — `hidden` on a room hides everything in it, and answers 404 to a member rather than 403.",
    operationId: "setForumPermission",
    middleware: authenticated,
    request: {
      params: TARGET_PARAMS,
      body: { required: true, content: jsonContent(SET_PERMISSION_BODY) },
    },
    responses: {
      [STATUS_CODE.OK]: {
        description: "The permission was set",
        content: jsonContent(OK_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.NotFound]: {
        description: "No such folder, thread or page in the forum",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...FORBIDDEN_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { targetType, targetId } = c.req.valid("param");
    const { memberPermission } = c.req.valid("json");
    const user = c.get("user");

    if (!mayActInForum(user, "permission:change")) {
      return c.json(
        { error: "Only operators can set what members may do here" },
        STATUS_CODE.Forbidden,
      );
    }

    const outcome = await ForumService.setPermission(
      targetType,
      targetId,
      memberPermission,
    );

    if (outcome === "notFound") {
      return c.json({ error: "Not found" }, STATUS_CODE.NotFound);
    }

    return c.json({ ok: true } as const, STATUS_CODE.OK);
  },
);
