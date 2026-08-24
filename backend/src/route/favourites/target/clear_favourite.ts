import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { STATUS_CODE } from "@std/http/status";
import { FAVOURITES_TAG } from "@/src/open_api_specification.ts";
import authenticated from "@/src/middleware/authenticated.ts";
import { FavouriteService } from "@/src/service/favourite_service.ts";
import { TARGET_PARAMS } from "./set_favourite.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  FORBIDDEN_RESPONSE,
  jsonContent,
  OK_RESPONSE,
} from "@/src/http/response.ts";

export default new OpenAPIHono().openapi(
  createRoute({
    method: "delete",
    path: "/",
    tags: [FAVOURITES_TAG],
    summary: "Stop something being a favourite",
    description:
      "Answers the same way whether it was a favourite or not, because absent is the state being asked for. Unlike marking one, this asks no visibility question: a group that has gone private since is exactly the favourite a member most wants rid of.",
    operationId: "clearFavourite",
    middleware: authenticated,
    request: { params: TARGET_PARAMS },
    responses: {
      [STATUS_CODE.OK]: {
        description: "It is not a favourite",
        content: jsonContent(OK_RESPONSE),
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
    const { targetType, targetId } = c.req.valid("param");

    await FavouriteService.clearFavourite(
      c.get("user"),
      targetType,
      targetId,
    );

    return c.json({ ok: true } as const, STATUS_CODE.OK);
  },
);
