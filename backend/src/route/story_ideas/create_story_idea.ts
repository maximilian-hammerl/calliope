import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { TEXT_LIMIT } from "@/src/text_limit.ts";
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
import {
  notBlank,
  STORY_CONTENT_WARNINGS_SCHEMA,
  STORY_GENRES_SCHEMA,
  STORY_SUBGENRES_SCHEMA,
  STORY_TROPES_SCHEMA,
} from "@/src/http/request_schema.ts";

const DETAIL_SCHEMA = z.string().max(TEXT_LIMIT.storyIdeaDetail).nullish();

export const STORY_IDEA_BODY = STORY_IDEA_SCHEMA
  .pick({
    title: true,
    subtitle: true,
    teaser: true,
    synopsis: true,
    tense: true,
    perspective: true,
    language: true,
    lookingFor: true,
    partySize: true,
    status: true,
  })
  .extend({
    // The title and both texts are required, and nothing else is: the metadata block is where
    // a mandatory field gets filled with nonsense. The two texts are the exception on purpose —
    // somebody unwilling to write a short version is not really asking to be answered.
    title: notBlank(
      STORY_IDEA_SCHEMA.shape.title.min(1).max(TEXT_LIMIT.storyIdeaTitle),
    ),
    subtitle: z.string().max(TEXT_LIMIT.storyIdeaSubtitle).nullish(),
    teaser: notBlank(
      STORY_IDEA_SCHEMA.shape.teaser.min(1).max(TEXT_LIMIT.storyIdeaTeaser),
    ),
    synopsis: notBlank(
      STORY_IDEA_SCHEMA.shape.synopsis.min(1).max(TEXT_LIMIT.storyIdeaSynopsis),
    ),
    language: STORY_IDEA_SCHEMA.shape.language.default("german"),
    lookingFor: DETAIL_SCHEMA,
    partySize: STORY_IDEA_SCHEMA.shape.partySize.optional(),
    status: STORY_IDEA_SCHEMA.shape.status.default("open"),
    genres: STORY_GENRES_SCHEMA,
    subgenres: STORY_SUBGENRES_SCHEMA,
    tropes: STORY_TROPES_SCHEMA,
    contentWarnings: STORY_CONTENT_WARNINGS_SCHEMA,
    tense: STORY_IDEA_SCHEMA.shape.tense.nullish(),
    perspective: STORY_IDEA_SCHEMA.shape.perspective.nullish(),
    storyThemes: z.string().max(TEXT_LIMIT.storyMetadataText).nullish(),
    storySettings: z.string().max(TEXT_LIMIT.storyMetadataText).nullish(),
  });

export default new OpenAPIHono().openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: [STORY_IDEAS_TAG],
    summary: "Post a story idea seeking writers",
    operationId: "createStoryIdea",
    middleware: authenticated,
    request: {
      body: { required: true, content: jsonContent(STORY_IDEA_BODY) },
    },
    responses: {
      [STATUS_CODE.Created]: {
        description: "The idea is on the board",
        content: jsonContent(STORY_IDEA_RESPONSE),
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
    const idea = await StoryIdeaService.insertStoryIdea(
      c.get("user").id,
      c.req.valid("json"),
    );
    return c.json(idea, STATUS_CODE.Created);
  },
);
