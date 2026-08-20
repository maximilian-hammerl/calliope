import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { STORY_IDEA_RESPONSE } from "@/src/http/response_schema.ts";
import { STORY_IDEAS_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import requireSession from "@/src/middleware/require_session.ts";
import { StoryIdeaService } from "@/src/service/story_idea_service.ts";
import {
  listQuerySchema,
  listResponseSchema,
} from "@/src/list/list_endpoint.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  FORBIDDEN_RESPONSE,
  jsonContent,
} from "@/src/http/response.ts";
import { STORY_IDEA_SCHEMA } from "@/src/database/schema.ts";

const SORT_ATTRIBUTE = STORY_IDEA_SCHEMA
  .keyof()
  .extract(["createdAt", "title"])
  // Newest first: the daily loop the interviews describe is "die neuen Gesuche durchgehen".
  .default("createdAt")
  .transform((attribute) => `storyIdea.${attribute}` as const);

// Open by default: closed ideas stop cluttering the board but stay reachable by asking.
const STATUS_FILTER = z.enum(["open", "closed", "any"]).default("open");

const LIST_STORY_IDEAS_BODY = listQuerySchema(
  SORT_ATTRIBUTE,
  {
    status: STATUS_FILTER,
    language: STORY_IDEA_SCHEMA.shape.language.optional(),
    // One's own ideas regardless of status: closing an idea must not hide it from its author.
    mine: z.boolean().default(false),
  },
  "desc",
);

export default new OpenAPIHono().openapi(
  createRoute({
    // QUERY is safe and idempotent like GET, but carries its parameters in a body.
    method: "query",
    path: "/",
    tags: [STORY_IDEAS_TAG],
    summary: "List story ideas seeking writers",
    description:
      "Newest first. Without a status filter only open ideas appear. The search looks at titles and the ideas themselves.",
    operationId: "listStoryIdeas",
    middleware: requireSession,
    request: {
      body: { required: true, content: jsonContent(LIST_STORY_IDEAS_BODY) },
    },
    responses: {
      [STATUS_CODE.OK]: {
        description: "A page of story ideas",
        content: jsonContent(listResponseSchema(STORY_IDEA_RESPONSE)),
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
    const { mine, ...query } = c.req.valid("json");
    const page = await StoryIdeaService.listStoryIdeas({
      ...query,
      // `mine` also widens the status filter: an author manages all their ideas, closed ones
      // included, and hiding those here would make closing one irreversible in the interface.
      ...(mine ? { createdBy: c.get("user").id, status: "any" as const } : {}),
    });
    return c.json(page, STATUS_CODE.OK);
  },
);
