import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { TEXT_LIMIT } from "@/src/text_limit.ts";
import { GROUP_RESPONSE } from "@/src/http/response_schema.ts";
import { GROUPS_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { WritingGroupService } from "@/src/service/writing_group_service.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  FORBIDDEN_RESPONSE,
  jsonContent,
} from "@/src/http/response.ts";
import { WRITING_GROUP_SCHEMA } from "@/src/database/schema.ts";
import {
  notBlank,
  STORY_CONTENT_WARNINGS_SCHEMA,
  STORY_GENRES_SCHEMA,
  STORY_SUBGENRES_SCHEMA,
  STORY_TROPES_SCHEMA,
} from "@/src/http/request_schema.ts";

const CREATE_GROUP_BODY = WRITING_GROUP_SCHEMA
  .pick({
    title: true,
    subtitle: true,
    synopsis: true,
    visibility: true,
    storyStatus: true,
    tense: true,
    perspective: true,
    language: true,
  })
  .extend({
    // The column only requires text; an empty title is not useful.
    title: notBlank(
      WRITING_GROUP_SCHEMA.shape.title.min(1).max(TEXT_LIMIT.groupTitle),
    ),
    subtitle: z.string().max(TEXT_LIMIT.groupSubtitle).nullish(),
    synopsis: WRITING_GROUP_SCHEMA.shape.synopsis.max(TEXT_LIMIT.groupSynopsis),
    // Private unless asked otherwise, per the "private by default" principle.
    visibility: WRITING_GROUP_SCHEMA.shape.visibility.default("private"),
    // The column's own default, restated so omitting the field is legal rather than a 400.
    storyStatus: WRITING_GROUP_SCHEMA.shape.storyStatus.default("planning"),
    language: WRITING_GROUP_SCHEMA.shape.language.default("german"),
    // Free text rather than a list: collaborative fiction mixes tense and person across
    // chapters and characters more than any fixed set would survive.
    genres: STORY_GENRES_SCHEMA,
    subgenres: STORY_SUBGENRES_SCHEMA,
    tropes: STORY_TROPES_SCHEMA,
    contentWarnings: STORY_CONTENT_WARNINGS_SCHEMA,
    tense: WRITING_GROUP_SCHEMA.shape.tense.nullish(),
    perspective: WRITING_GROUP_SCHEMA.shape.perspective.nullish(),
    storyThemes: z.string().max(TEXT_LIMIT.storyMetadataText).nullish(),
    storySettings: z.string().max(TEXT_LIMIT.storyMetadataText).nullish(),
  });

export default new OpenAPIHono().openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: [GROUPS_TAG],
    summary: "Create a group, with the creating user as its administrator",
    description:
      "Creates a writing group and joins the creating user to it as its administrator. Groups are private unless the request asks for a public one.",
    operationId: "createGroup",
    middleware: authenticated,
    request: {
      body: { required: true, content: jsonContent(CREATE_GROUP_BODY) },
    },
    responses: {
      [STATUS_CODE.Created]: {
        description: "Group created",
        content: jsonContent(GROUP_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...FORBIDDEN_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const values = c.req.valid("json");

    const writingGroup = await WritingGroupService.insertWritingGroup(
      c.get("user"),
      {
        ...values,
        subtitle: values.subtitle ?? null,
        tense: values.tense ?? null,
        perspective: values.perspective ?? null,
      },
    );

    return c.json(writingGroup, STATUS_CODE.Created);
  },
);
