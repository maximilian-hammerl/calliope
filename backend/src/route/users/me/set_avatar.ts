import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { STATUS_CODE } from "@std/http/status";
import { USERS_TAG } from "@/src/open_api_specification.ts";
import authenticated from "@/src/middleware/authenticated.ts";
import {
  AVATAR_ORIGIN_SCHEMA,
  USER_AVATAR_SCHEMA,
} from "@/src/database/schema.ts";
import { UserAvatarService } from "@/src/service/user_avatar_service.ts";
import { avatarUrl } from "@/src/http/avatar_url.ts";
import { TEXT_LIMIT, UPLOAD_BODY_LIMIT_BYTES } from "@/src/text_limit.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  FORBIDDEN_RESPONSE,
  jsonContent,
} from "@/src/http/response.ts";

/**
 * The one non-JSON body in the API. Multipart rather than base64 in JSON, which would inflate a
 * photograph by a third to travel through a shape it does not fit.
 */
const SET_AVATAR_BODY = z.object({
  // `maxLength` on a binary string is its size in bytes, so the interface generates the same
  // number the body limit enforces rather than restating it.
  image: z.instanceof(File).openapi({
    type: "string",
    format: "binary",
    maxLength: UPLOAD_BODY_LIMIT_BYTES,
  }),
  origin: AVATAR_ORIGIN_SCHEMA,
  // Multipart carries no types: everything arrives as a string.
  credit: USER_AVATAR_SCHEMA.shape.credit.unwrap().max(TEXT_LIMIT.avatarCredit)
    .optional(),
  confirmed: z.literal("true"),
});

const AVATAR_RESPONSE = z.object({ avatarUrl: z.string() });

export default new OpenAPIHono().openapi(
  createRoute({
    method: "put",
    path: "/avatar",
    tags: [USERS_TAG],
    summary: "Set the member's own picture",
    description:
      "Replaces whatever picture the member had. The image is re-encoded to one square WebP, which is also what strips its metadata; the original is never stored. `confirmed` is the member's declaration that they may use the picture, and `credit` says where it came from unless it is their own work.",
    operationId: "setAvatar",
    middleware: authenticated,
    request: {
      body: {
        required: true,
        content: { "multipart/form-data": { schema: SET_AVATAR_BODY } },
      },
    },
    responses: {
      [STATUS_CODE.OK]: {
        description: "The picture is set",
        content: jsonContent(AVATAR_RESPONSE),
      },
      [STATUS_CODE.UnprocessableEntity]: {
        description: "Not a picture in a format we accept",
        content: jsonContent(ERROR_RESPONSE),
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
    const { image, origin, credit } = c.req.valid("form");
    const declaration = { origin, credit: credit ?? null };

    // What the CHECK on the table says, said here so a member is told rather than 500ed.
    if (origin !== "own_work" && declaration.credit === null) {
      return c.json(
        {
          error: "A picture that is not your own has to say where it came from",
        },
        STATUS_CODE.BadRequest,
      );
    }

    const bytes = new Uint8Array(await image.arrayBuffer());
    const result = await UserAvatarService.setAvatar(
      c.get("user").id,
      bytes,
      declaration,
    );

    return result.kind === "not_an_image"
      ? c.json(
        { error: "That is not a picture we can read" },
        STATUS_CODE.UnprocessableEntity,
      )
      : c.json({ avatarUrl: avatarUrl(result.fileId) }, STATUS_CODE.OK);
  },
);
