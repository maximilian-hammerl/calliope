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
    path: "/reader-state",
    tags: [STORY_IDEAS_TAG],
    summary: "Set an idea back to unread",
    description:
      "Removes the member's own state. Answers the same way whether a state was there or not, because unread is the absence of one.",
    operationId: "clearReaderState",
    middleware: authenticated,
    request: { params: IDEA_PARAMS },
    responses: {
      [STATUS_CODE.OK]: {
        description: "The idea is unread again",
        content: jsonContent(OK_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.NotFound]: {
        description: "No such idea",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const user = c.get("user");
    const { ideaId } = c.req.valid("param");

    const idea = await StoryIdeaService.selectStoryIdea(ideaId, user.id);
    if (idea === undefined) {
      return c.json({ error: "Not found" }, STATUS_CODE.NotFound);
    }

    await StoryIdeaService.clearReaderState(ideaId, user.id);
    return c.json({ ok: true } as const, STATUS_CODE.OK);
  },
);
