import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { STORY_IDEA_RESPONSE } from "@/src/http/response_schema.ts";
import { STORY_IDEAS_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { StoryIdeaService } from "@/src/service/story_idea_service.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  FORBIDDEN_RESPONSE,
  jsonContent,
} from "@/src/http/response.ts";
import { STORY_IDEA_SCHEMA } from "@/src/database/schema.ts";

const IDEA_PARAMS = z.object({ ideaId: STORY_IDEA_SCHEMA.shape.id });

export default new OpenAPIHono().openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: [STORY_IDEAS_TAG],
    summary: "Read one story idea",
    operationId: "getStoryIdea",
    middleware: authenticated,
    request: { params: IDEA_PARAMS },
    responses: {
      [STATUS_CODE.OK]: {
        description: "The story idea",
        content: jsonContent(STORY_IDEA_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.NotFound]: {
        description: "No idea has this id",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...FORBIDDEN_RESPONSE,
      ...BAD_REQUEST_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const idea = await StoryIdeaService.selectStoryIdea(
      c.req.valid("param").ideaId,
      c.get("user").id,
    );

    if (idea === undefined) {
      return c.json({ error: "Not found" }, STATUS_CODE.NotFound);
    }

    return c.json(idea, STATUS_CODE.OK);
  },
);
