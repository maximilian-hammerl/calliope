import {
  STORY_GENRES_FILTER,
  STORY_SUBGENRES_FILTER,
  STORY_TROPES_FILTER,
} from "@/src/http/request_schema.ts";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { listQuery } from "@/src/list/list_endpoint_query.ts";
import { GROUP_RESPONSE } from "@/src/http/response_schema.ts";
import { GROUPS_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { WritingGroupService } from "@/src/service/writing_group_service.ts";
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
import type {
  UserInWritingGroup as UserInWritingGroupTable,
  WritingGroup as WritingGroupTable,
} from "@/src/database/schema.ts";

const SORT_ATTRIBUTES = [
  "createdAt",
  "lastActivityAt",
  "title",
  "invitedAt",
] as const;

/**
 * Public attribute names mapped to qualified columns, so the API never exposes the schema and
 * only these values can ever reach `dynamic.ref`. `invitedAt` is the *membership's* column:
 * for the invitations list the date that matters is when the reader was asked, which the group
 * itself does not know. It is null on every other row, and `listResultsWithCount` orders nulls
 * last, so asking for it elsewhere degrades rather than misleads.
 *
 * The `satisfies` is the rename guard the `.keyof().extract()` pattern gives elsewhere: a value
 * that is not a column on one of the two tables fails to compile.
 */
const SORT_COLUMN = {
  createdAt: "writingGroup.createdAt",
  lastActivityAt: "writingGroup.lastActivityAt",
  title: "writingGroup.title",
  invitedAt: "userInWritingGroup.invitedAt",
} as const satisfies Record<
  (typeof SORT_ATTRIBUTES)[number],
  | `writingGroup.${keyof WritingGroupTable & string}`
  | `userInWritingGroup.${keyof UserInWritingGroupTable & string}`
>;

const SORT_ATTRIBUTE = z
  .enum(SORT_ATTRIBUTES)
  .default("createdAt")
  .transform((attribute) => SORT_COLUMN[attribute]);

/**
 * Which groups, relative to the caller. The default is `joined`, because the list this backs
 * is "Meine Gruppen" and a group somebody merely may read is not theirs. `none` is the
 * discovery list, `any` the older behaviour of everything they are allowed to see.
 */
const MEMBERSHIP = z
  .enum(["joined", "invited", "none", "any"])
  .default("joined")
  .meta({
    description:
      "Which groups relative to the caller: ones they have joined, ones they have been invited to, public ones they are not in, or everything they may see.",
  });

const LIST_GROUPS_BODY = listQuerySchema(
  SORT_ATTRIBUTE,
  {
    membership: MEMBERSHIP,
    favourite: FAVOURITE_FILTER,
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
    tags: [GROUPS_TAG],
    summary: "List groups, by default the current user's own",
    description:
      "Returns a page of groups, by default the ones the current user has joined. The membership filter selects invitations, public groups they are not in, or everything they may see instead.",
    operationId: "listGroups",
    middleware: authenticated,
    // Required, so that an absent body cannot skip validation and lose the defaults.
    request: {
      body: { required: true, content: jsonContent(LIST_GROUPS_BODY) },
    },
    responses: {
      [STATUS_CODE.OK]: {
        description: "A page of groups",
        content: jsonContent(listResponseSchema(GROUP_RESPONSE)),
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
    const page = await WritingGroupService.listVisibleWritingGroups(
      c.get("user"),
      listQuery(c.req.valid("json")),
    );

    return c.json(page, STATUS_CODE.OK);
  },
);
