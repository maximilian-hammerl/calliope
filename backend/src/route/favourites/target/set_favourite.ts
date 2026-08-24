import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { STATUS_CODE } from "@std/http/status";
import { FAVOURITES_TAG } from "@/src/open_api_specification.ts";
import authenticated from "@/src/middleware/authenticated.ts";
import { FavouriteService } from "@/src/service/favourite_service.ts";
import { FAVOURITE_TARGET_TYPES } from "@/src/service/favourite_target.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  jsonContent,
  OK_RESPONSE,
} from "@/src/http/response.ts";

/**
 * One pair of routes for all five kinds rather than a `/favourite` under each of them. The act is
 * identical whatever it names, and the issue's whole point is that there is one mechanism — ten
 * routes saying the same thing would be the three-schemas problem in another shape, and would
 * reach the client as five hooks instead of one.
 */
export const TARGET_PARAMS = z.object({
  targetType: z.enum(FAVOURITE_TARGET_TYPES),
  targetId: z.uuidv7(),
});

export default new OpenAPIHono().openapi(
  createRoute({
    method: "put",
    path: "/",
    tags: [FAVOURITES_TAG],
    summary: "Mark something as a favourite",
    description:
      "The member's own favourite, visible to nobody else, on a group, a thread, a post, a story idea or a chat. Idempotent: favouriting twice is the same as favouriting once. Answers 404 for anything the member cannot see, so this cannot be used to find out that something exists.",
    operationId: "setFavourite",
    middleware: authenticated,
    request: { params: TARGET_PARAMS },
    responses: {
      [STATUS_CODE.OK]: {
        description: "It is a favourite",
        content: jsonContent(OK_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.NotFound]: {
        description: "No such thing, or the member cannot see it",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { targetType, targetId } = c.req.valid("param");

    const refusal = await FavouriteService.setFavourite(
      c.get("user"),
      targetType,
      targetId,
    );

    return refusal === "not_found"
      ? c.json({ error: "Not found" }, STATUS_CODE.NotFound)
      : c.json({ ok: true } as const, STATUS_CODE.OK);
  },
);
