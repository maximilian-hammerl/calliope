import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { TEXT_LIMIT } from "@/src/text_limit.ts";
import { USERS_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { UserService } from "@/src/service/user_service.ts";
import { USER_PROFILE_RESPONSE } from "@/src/http/response_schema.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  FORBIDDEN_RESPONSE,
  jsonContent,
} from "@/src/http/response.ts";

/** One answer each, so they share a bound; `aboutMe` is the one that invites prose. */
const DETAIL = z.string().max(TEXT_LIMIT.profileDetail).nullish();

/**
 * Nullish, never defaulted: a default materialises the field the client omitted, so every
 * partial update would silently empty the rest of the profile — the story tags' own bug.
 */
const UPDATE_OWN_PROFILE_BODY = z
  .object({
    aboutMe: z.string().max(TEXT_LIMIT.profileAboutMe).nullish(),
    writingStyle: DETAIL,
    postLength: DETAIL,
    writingFrequency: DETAIL,
    coWriterExpectations: DETAIL,
    writingBoundaries: DETAIL,
    genres: DETAIL,
  })
  .refine(
    (changes) => Object.values(changes).some((value) => value !== undefined),
    { message: "Provide at least one field to update" },
  );

export default new OpenAPIHono().openapi(
  createRoute({
    method: "patch",
    path: "/",
    tags: [USERS_TAG],
    summary: "Update the current member's profile",
    description:
      "Every field is optional and none is ever required. An omitted field is left alone; an empty one is cleared. What a profile holds is readable by every member, so a field a member does not want read is one they leave empty.",
    operationId: "updateOwnProfile",
    middleware: authenticated,
    request: {
      body: { required: true, content: jsonContent(UPDATE_OWN_PROFILE_BODY) },
    },
    responses: {
      [STATUS_CODE.OK]: {
        description: "The profile as it now stands",
        content: jsonContent(USER_PROFILE_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.NotFound]: {
        description:
          "The account no longer exists — it was deleted between this request being authenticated and the update",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...FORBIDDEN_RESPONSE,
      ...BAD_REQUEST_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const user = c.get("user");
    const profile = await UserService.updateProfile(
      user.id,
      c.req.valid("json"),
    );

    if (profile === undefined) {
      return c.json({ error: "Not found" }, STATUS_CODE.NotFound);
    }

    // Their own profile, so never blocked; a banned account has no session to get here.
    return c.json({ ...profile, isBlocked: false }, STATUS_CODE.OK);
  },
);
