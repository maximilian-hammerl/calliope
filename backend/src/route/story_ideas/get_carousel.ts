import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { STORY_IDEA_CAROUSEL_RESPONSE } from "@/src/http/response_schema.ts";
import { STORY_IDEAS_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { StoryIdeaService } from "@/src/service/story_idea_service.ts";
import { BlockService } from "@/src/service/block_service.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  FORBIDDEN_RESPONSE,
  jsonContent,
} from "@/src/http/response.ts";
import { STORY_IDEA_SCHEMA } from "@/src/database/schema.ts";

const CAROUSEL_BODY = z.object({
  /** Absent means the newest idea of the set, which is where the carousel opens. */
  storyIdeaId: STORY_IDEA_SCHEMA.shape.id.optional(),
});

export default new OpenAPIHono().openapi(
  createRoute({
    // QUERY rather than GET: the anchor is a parameter, and parameters travel in a body here.
    method: "query",
    path: "/carousel",
    tags: [STORY_IDEAS_TAG],
    summary: "One step of the story-idea carousel",
    description:
      "The idea to show and the two either side of it, out of the open ideas the member has not read and did not write. Takes no filters: the set is the view's own. A missing neighbour is the end of the set, where the carousel stops rather than wrapping.",
    operationId: "getStoryIdeaCarousel",
    middleware: authenticated,
    request: {
      body: { required: true, content: jsonContent(CAROUSEL_BODY) },
    },
    responses: {
      [STATUS_CODE.OK]: {
        description: "The step, and how many ideas the set holds",
        content: jsonContent(STORY_IDEA_CAROUSEL_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.NotFound]: {
        description: "The anchor is not one of the ideas this carousel walks",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...FORBIDDEN_RESPONSE,
      ...BAD_REQUEST_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const user = c.get("user");
    const carousel = await StoryIdeaService.selectCarousel(
      user.id,
      await BlockService.selectBlockedIds(user.id),
      c.req.valid("json").storyIdeaId,
    );

    // The anchor exists as far as the member is concerned but is not in this set — their own
    // idea, a closed one, or one whose author they have blocked.
    if (carousel === undefined) {
      return c.json({ error: "Not found" }, STATUS_CODE.NotFound);
    }

    return c.json(carousel, STATUS_CODE.OK);
  },
);
