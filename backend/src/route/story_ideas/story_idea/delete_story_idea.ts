import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { STORY_IDEAS_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { StoryIdeaService } from "@/src/service/story_idea_service.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  jsonContent,
  OK_RESPONSE,
} from "@/src/http/response.ts";
import { STORY_IDEA_SCHEMA } from "@/src/database/schema.ts";

const IDEA_PARAMS = z.object({ ideaId: STORY_IDEA_SCHEMA.shape.id });

export default new OpenAPIHono().openapi(
  createRoute({
    method: "delete",
    path: "/",
    tags: [STORY_IDEAS_TAG],
    summary: "Take one's own story idea off the board",
    operationId: "deleteStoryIdea",
    middleware: authenticated,
    request: { params: IDEA_PARAMS },
    responses: {
      [STATUS_CODE.OK]: {
        description: "The idea is gone",
        content: jsonContent(OK_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.Forbidden]: {
        description: "The idea belongs to somebody else",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.NotFound]: {
        description: "No idea has this id",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { ideaId } = c.req.valid("param");

    const deleted = await StoryIdeaService.deleteStoryIdea(
      ideaId,
      c.get("user").id,
    );

    if (deleted) {
      return c.json({ ok: true } as const, STATUS_CODE.OK);
    }

    const exists = await StoryIdeaService.selectStoryIdeaGate(ideaId);
    return exists === undefined
      ? c.json({ error: "Not found" }, STATUS_CODE.NotFound)
      : c.json({ error: "Not yours to remove" }, STATUS_CODE.Forbidden);
  },
);
