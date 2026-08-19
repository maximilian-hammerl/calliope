import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  FOUND_THREAD_RESPONSE,
  GROUP_RESPONSE,
  USER_RESPONSE,
} from "@/src/http/response_schema.ts";
import { SEARCH_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import requireSession from "@/src/middleware/require_session.ts";
import { WritingGroupService } from "@/src/service/writing_group_service.ts";
import { WritingThreadService } from "@/src/service/writing_thread_service.ts";
import { UserService } from "@/src/service/user_service.ts";
import { listResponseSchema } from "@/src/list/list_endpoint.ts";
import { TEXT_LIMIT, TEXT_MINIMUM } from "@/src/text_limit.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  jsonContent,
} from "@/src/http/response.ts";

/**
 * Small on purpose: this fills a popover under the search field, not a page. Each section
 * reports its own total, so the interface can say how many more there are without asking for
 * them.
 */
const RESULTS_PER_SECTION = 5;

const SEARCH_BODY = z.object({
  search: z.string().min(TEXT_MINIMUM.search).max(TEXT_LIMIT.search),
  limit: z.number().int().min(1).max(20).default(RESULTS_PER_SECTION),
});

const SEARCH_RESPONSE = z.object({
  groups: listResponseSchema(GROUP_RESPONSE),
  threads: listResponseSchema(FOUND_THREAD_RESPONSE),
  users: listResponseSchema(USER_RESPONSE),
});

export default new OpenAPIHono().openapi(
  createRoute({
    // QUERY like every other read whose parameters are a body, and it keeps what somebody
    // searched for out of access logs, history and the `Referer` header.
    method: "query",
    path: "/",
    tags: [SEARCH_TAG],
    summary: "Search groups, threads and members at once",
    description:
      "Runs one search across everything the current user may see and returns the matches grouped by kind, each with the total number found. Posts are not searched yet.",
    operationId: "search",
    middleware: requireSession,
    // Required, so that an absent body cannot skip validation and lose the defaults.
    request: {
      body: { required: true, content: jsonContent(SEARCH_BODY) },
    },
    responses: {
      [STATUS_CODE.OK]: {
        description: "What was found, by kind",
        content: jsonContent(SEARCH_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { search, limit } = c.req.valid("json");
    const user = c.get("user");

    // Each service applies its own visibility rule, so authorisation is not restated here.
    // In parallel: three independent reads, and the slowest decides how long this takes.
    const [groups, threads, users] = await Promise.all([
      WritingGroupService.listVisibleWritingGroups(user, {
        search,
        limit,
        offset: 0,
        // Most recently active first: the closest thing to relevance without ranking.
        sortAttribute: "writingGroup.lastActivityAt",
        sortOrder: "desc",
        // Search looks everywhere the reader may look, which is what the default narrows.
        membership: "any",
      }),
      WritingThreadService.listVisibleThreads(user, {
        search,
        limit,
        offset: 0,
        sortAttribute: "writingThread.lastActivityAt",
        sortOrder: "desc",
      }),
      UserService.listUsers({
        search,
        limit,
        offset: 0,
        sortAttribute: "user.username",
        sortOrder: "asc",
      }),
    ]);

    return c.json({ groups, threads, users }, STATUS_CODE.OK);
  },
);
