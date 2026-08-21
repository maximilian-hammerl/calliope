import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { STORY_IDEAS_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import requireSession from "@/src/middleware/require_session.ts";
import { StoryIdeaService } from "@/src/service/story_idea_service.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  jsonContent,
  OK_RESPONSE,
} from "@/src/http/response.ts";
import {
  STORY_IDEA_READER_SCHEMA,
  STORY_IDEA_SCHEMA,
} from "@/src/database/schema.ts";

const IDEA_PARAMS = z.object({ ideaId: STORY_IDEA_SCHEMA.shape.id });

const SET_READER_STATE_BODY = z.object({
  state: STORY_IDEA_READER_SCHEMA.shape.state,
});

export default new OpenAPIHono().openapi(
  createRoute({
    method: "put",
    path: "/reader-state",
    tags: [STORY_IDEAS_TAG],
    summary: "Mark an idea as read, or worth coming back to",
    description:
      "The member's own state on somebody else's idea. Idempotent: setting it again overwrites what was there. Unread is the absence of a state, so clearing it is a DELETE.",
    operationId: "setReaderState",
    middleware: requireSession,
    request: {
      params: IDEA_PARAMS,
      body: { required: true, content: jsonContent(SET_READER_STATE_BODY) },
    },
    responses: {
      [STATUS_CODE.OK]: {
        description: "The state was set",
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
    const { state } = c.req.valid("json");

    const idea = await StoryIdeaService.selectStoryIdea(ideaId, user.id);
    if (idea === undefined) {
      return c.json({ error: "Not found" }, STATUS_CODE.NotFound);
    }
    // A state on one's own idea would never be shown: discovery never lists it back.
    if (idea.createdBy === user.id) {
      return c.json({ error: "Your own idea" }, STATUS_CODE.Forbidden);
    }

    await StoryIdeaService.setReaderState(ideaId, user.id, state);
    return c.json({ ok: true } as const, STATUS_CODE.OK);
  },
);
