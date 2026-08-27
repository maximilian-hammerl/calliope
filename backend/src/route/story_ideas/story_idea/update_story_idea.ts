import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { STORY_IDEA_RESPONSE } from "@/src/http/response_schema.ts";
import { STORY_IDEAS_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { StoryIdeaService } from "@/src/service/story_idea_service.ts";
import { STORY_IDEA_BODY } from "@/src/route/story_ideas/create_story_idea.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  jsonContent,
} from "@/src/http/response.ts";
import { STORY_IDEA_SCHEMA } from "@/src/database/schema.ts";

const IDEA_PARAMS = z.object({ ideaId: STORY_IDEA_SCHEMA.shape.id });

// `.partial()` after the defaults, so an omitted field stays undefined and means unchanged —
// a default materialising on PATCH is how tags once got cleared by every partial update.
const UPDATE_STORY_IDEA_BODY = STORY_IDEA_BODY
  .partial()
  .refine(
    (changes) => Object.values(changes).some((value) => value !== undefined),
    { message: "Provide at least one field to update" },
  );

export default new OpenAPIHono().openapi(
  createRoute({
    method: "patch",
    path: "/",
    tags: [STORY_IDEAS_TAG],
    summary: "Update one's own story idea",
    description:
      "Only the idea's author may change it, its status included. Absent fields stay as they are.",
    operationId: "updateStoryIdea",
    middleware: authenticated,
    request: {
      params: IDEA_PARAMS,
      body: { required: true, content: jsonContent(UPDATE_STORY_IDEA_BODY) },
    },
    responses: {
      [STATUS_CODE.OK]: {
        description: "The idea as it now reads",
        content: jsonContent(STORY_IDEA_RESPONSE),
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

    const updated = await StoryIdeaService.updateStoryIdea(
      ideaId,
      c.get("user").id,
      c.req.valid("json"),
    );

    if (updated !== undefined) {
      return c.json(updated, STATUS_CODE.OK);
    }

    // Everyone may see every idea, so unlike a private group the split is honest here:
    // an existing idea that did not update is somebody else's.
    const exists = await StoryIdeaService.selectStoryIdeaGate(ideaId);
    return exists === undefined
      ? c.json({ error: "Not found" }, STATUS_CODE.NotFound)
      : c.json({ error: "Not yours to change" }, STATUS_CODE.Forbidden);
  },
);
