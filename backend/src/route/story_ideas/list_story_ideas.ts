import {
  STORY_GENRES_FILTER,
  STORY_SUBGENRES_FILTER,
  STORY_TROPES_FILTER,
} from "@/src/http/request_schema.ts";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { listQuery } from "@/src/list/list_endpoint_query.ts";
import { STORY_IDEA_RESPONSE } from "@/src/http/response_schema.ts";
import { STORY_IDEAS_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { StoryIdeaService } from "@/src/service/story_idea_service.ts";
import { BlockService } from "@/src/service/block_service.ts";
import {
  FAVOURITE_FILTER,
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

/**
 * `any` rather than `unread` by default: the board's own default filter is a frontend
 * decision, and an endpoint that hid read ideas unless asked would surprise every other caller.
 */
const READER_STATE_FILTER = z
  .enum(["read", "unread", "any"])
  .default("any");

const LIST_STORY_IDEAS_BODY = listQuerySchema(
  SORT_ATTRIBUTE,
  {
    status: STATUS_FILTER,
    readerState: READER_STATE_FILTER,
    favourite: FAVOURITE_FILTER,
    language: STORY_IDEA_SCHEMA.shape.language.optional(),
    // The board is discovery, so `others` is the default: like a public group the reader is
    // already in, their own idea is not something to find.
    author: z.enum(["others", "mine"]).default("others"),
    // The same schemas the create bodies use, so what may be chosen and what may be filtered
    // by cannot drift apart. Absent means "not asked" — an untouched filter never empties a board.
    genres: STORY_GENRES_FILTER,
    subgenres: STORY_SUBGENRES_FILTER,
    tropes: STORY_TROPES_FILTER,
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
      "Newest first. The reader's own ideas are excluded unless asked for with author `mine`; without a status filter only open ideas appear. The search looks at titles and the ideas themselves.",
    operationId: "listStoryIdeas",
    middleware: authenticated,
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
    const { author, ...query } = listQuery(c.req.valid("json"));
    const page = await StoryIdeaService.listStoryIdeas({
      ...query,
      readerId: c.get("user").id,
      hiddenAuthorIds: await BlockService.selectBlockedIds(c.get("user").id),
      // `mine` also widens the status filter: an author manages all their ideas, closed ones
      // included, and hiding those here would make closing one irreversible in the interface.
      ...(author === "mine"
        ? { createdBy: c.get("user").id, status: "any" as const }
        : { excludeCreatedBy: c.get("user").id }),
    });
    return c.json(page, STATUS_CODE.OK);
  },
);
