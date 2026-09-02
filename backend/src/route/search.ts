import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { notBlank } from "@/src/http/request_schema.ts";
import {
  FOUND_PAGE_RESPONSE,
  FOUND_THREAD_RESPONSE,
  GROUP_RESPONSE,
  LISTED_MEMBER_RESPONSE,
  STORY_IDEA_RESPONSE,
} from "@/src/http/response_schema.ts";
import { SEARCH_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { WritingGroupService } from "@/src/service/writing_group_service.ts";
import { WritingThreadService } from "@/src/service/writing_thread_service.ts";
import { WritingPageService } from "@/src/service/writing_page_service.ts";
import { StoryIdeaService } from "@/src/service/story_idea_service.ts";
import { UserService } from "@/src/service/user_service.ts";
import { BlockService } from "@/src/service/block_service.ts";
import { listResponseSchema } from "@/src/list/list_endpoint.ts";
import { TEXT_LIMIT, TEXT_MINIMUM } from "@/src/text_limit.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  FORBIDDEN_RESPONSE,
  jsonContent,
} from "@/src/http/response.ts";

/**
 * Small on purpose: this fills a popover under the search field, not a page. Each section
 * reports its own total, so the interface can say how many more there are without asking for
 * them.
 */
const RESULTS_PER_SECTION = 5;

const SEARCH_BODY = z.object({
  search: notBlank(z.string().min(TEXT_MINIMUM.search).max(TEXT_LIMIT.search)),
  limit: z.number().int().min(1).max(20).default(RESULTS_PER_SECTION),
});

const SEARCH_RESPONSE = z.object({
  groups: listResponseSchema(GROUP_RESPONSE),
  threads: listResponseSchema(FOUND_THREAD_RESPONSE),
  pages: listResponseSchema(FOUND_PAGE_RESPONSE),
  storyIdeas: listResponseSchema(STORY_IDEA_RESPONSE),
  users: listResponseSchema(LISTED_MEMBER_RESPONSE),
});

export default new OpenAPIHono().openapi(
  createRoute({
    // QUERY like every other read whose parameters are a body, and it keeps what somebody
    // searched for out of access logs, history and the `Referer` header.
    method: "query",
    path: "/",
    tags: [SEARCH_TAG],
    summary: "Search groups, threads, story ideas and members at once",
    description:
      "Runs one search across everything the current user may see and returns the matches grouped by kind, each with the total number found. Story ideas include the reader's own and closed ones, which the interface labels. Posts, chat messages and next steps are not searched.",
    operationId: "search",
    middleware: authenticated,
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
      ...FORBIDDEN_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { search, limit } = c.req.valid("json");
    const user = c.get("user");

    // Each service applies its own visibility rule, so authorisation is not restated here.
    // In parallel: three independent reads, and the slowest decides how long this takes.
    // Read before the searches, so the member filter has it and the others are unaffected.
    const blockedIds = await BlockService.selectBlockedIds(user.id);

    const [groups, threads, pages, storyIdeas, users] = await Promise.all([
      WritingGroupService.listVisibleWritingGroups(user, {
        search,
        limit,
        offset: 0,
        // Most recently active first: the closest thing to relevance without ranking.
        sort: [{ attribute: "writingGroup.lastActivityAt", order: "desc" }],
        // Search looks everywhere the reader may look, which is what the default narrows.
        membership: "any",
        // Search ranks by relevance to the term, not by what the reader keeps.
        favourite: "any",
      }),
      WritingThreadService.listVisibleThreads(user, {
        search,
        limit,
        offset: 0,
        sort: [{ attribute: "writingThread.lastActivityAt", order: "desc" }],
      }),
      WritingPageService.listVisiblePages(user, {
        search,
        limit,
        offset: 0,
        // As threads sort: most recently written in first, which a page's own column carries.
        sort: [{ attribute: "writingPage.lastActivityAt", order: "desc" }],
      }),
      StoryIdeaService.listStoryIdeas({
        search,
        limit,
        offset: 0,
        readerId: user.id,
        // Newest first, as the board sorts: an idea has no activity to be recent by.
        sort: [{ attribute: "storyIdea.createdAt", order: "desc" }],
        // Unlike the board, neither the reader's own ideas nor closed ones are held back —
        // somebody searching for an idea wants the one they mean, and both carry a label.
        status: "any",
        // Read or marked is the reader's own bookkeeping, not a reason to hide a match.
        readerState: "any",
        favourite: "any",
        hiddenAuthorIds: blockedIds,
      }),
      UserService.listUsers({
        search,
        limit,
        offset: 0,
        sort: [{ attribute: "user.username", order: "asc" }],
        hiddenUserIds: blockedIds,
      }),
    ]);

    return c.json(
      { groups, threads, pages, storyIdeas, users },
      STATUS_CODE.OK,
    );
  },
);
