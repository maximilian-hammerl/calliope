import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { USERS_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { UserService } from "@/src/service/user_service.ts";
import { BlockService } from "@/src/service/block_service.ts";
import { BanService } from "@/src/service/ban_service.ts";
import { mayModeratePlatform } from "@/src/service/platform_authorization.ts";
import { USER_PROFILE_RESPONSE } from "@/src/http/response_schema.ts";
import { USER_SCHEMA } from "@/src/database/schema.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  FORBIDDEN_RESPONSE,
  jsonContent,
} from "@/src/http/response.ts";

const USER_PARAMS = z.object({ userId: USER_SCHEMA.shape.id });

export default new OpenAPIHono().openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: [USERS_TAG],
    summary: "Read a member's profile",
    description:
      "The name and the date they joined. An operator additionally sees whether the account is banned; nobody else does.",
    operationId: "getUser",
    middleware: authenticated,
    request: { params: USER_PARAMS },
    responses: {
      [STATUS_CODE.OK]: {
        description: "The member's profile",
        content: jsonContent(USER_PROFILE_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.NotFound]: {
        description: "No member has this id",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...FORBIDDEN_RESPONSE,
      ...BAD_REQUEST_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { userId } = c.req.valid("param");
    const profile = await UserService.selectUserProfile(userId);

    if (profile === undefined) {
      return c.json({ error: "Not found" }, STATUS_CODE.NotFound);
    }

    const reader = c.get("user");
    const isBlocked = await BlockService.isBlockedByUser(reader.id, userId);

    return c.json({
      ...profile,
      isBlocked,
      ...(mayModeratePlatform(reader.platformRole)
        ? { isBanned: await BanService.isBanned(userId) }
        : {}),
    }, STATUS_CODE.OK);
  },
);
