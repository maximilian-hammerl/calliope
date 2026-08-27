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
    method: "put",
    path: "/read",
    tags: [STORY_IDEAS_TAG],
    summary: "Mark an idea as read",
    description:
      "The member's own record of having read somebody else's idea, and nothing more: keeping one to come back to is a favourite, which covers all five kinds. Idempotent, and it takes no body — read is the presence of the record, so unread is a DELETE.",
    operationId: "markStoryIdeaRead",
    middleware: authenticated,
    request: { params: IDEA_PARAMS },
    responses: {
      [STATUS_CODE.OK]: {
        description: "The idea is marked read",
        content: jsonContent(OK_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.Forbidden]: {
        description: "The reader's own idea",
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

    const idea = await StoryIdeaService.selectStoryIdeaGate(ideaId);
    if (idea === undefined) {
      return c.json({ error: "Not found" }, STATUS_CODE.NotFound);
    }
    // Having read one's own idea would never be shown: discovery never lists it back.
    if (idea.createdBy === user.id) {
      return c.json({ error: "Your own idea" }, STATUS_CODE.Forbidden);
    }

    await StoryIdeaService.markRead(ideaId, user.id);
    return c.json({ ok: true } as const, STATUS_CODE.OK);
  },
);
