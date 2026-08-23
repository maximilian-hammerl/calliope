import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { MEMBERSHIP_RESPONSE } from "@/src/http/response_schema.ts";
import { MEMBERSHIPS_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { WritingGroupService } from "@/src/service/writing_group_service.ts";
import { UserInWritingGroupService } from "@/src/service/user_in_writing_group_service.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  FORBIDDEN_RESPONSE,
  jsonContent,
} from "@/src/http/response.ts";
import { WRITING_GROUP_SCHEMA } from "@/src/database/schema.ts";

const GROUP_PARAMS = z.object({ groupId: WRITING_GROUP_SCHEMA.shape.id });

/**
 * Not a page, unlike every other list here: a group is a handful of people, and somebody
 * missing from the list of who is in it is a worse failure than a long list. The interface
 * groups joined above invited and sorts by name, which it can only get right holding all of
 * them. There is nothing to sort or search server-side either, so this takes no body at all —
 * which is what makes it a GET.
 */
const MEMBERSHIPS_RESPONSE = z.object({
  results: z.array(MEMBERSHIP_RESPONSE),
});

export default new OpenAPIHono().openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: [MEMBERSHIPS_TAG],
    summary: "List the memberships and invitations of a group",
    description:
      "Every membership of the group, invitations included, in one answer. Not paged: a member missing from the list of who is in a group is worse than a long list.",
    operationId: "listMemberships",
    middleware: authenticated,
    request: { params: GROUP_PARAMS },
    responses: {
      [STATUS_CODE.OK]: {
        description: "Everyone in the group",
        content: jsonContent(MEMBERSHIPS_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.NotFound]: {
        description: "No such group, or it is private and not the user's",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...FORBIDDEN_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { groupId } = c.req.valid("param");

    const writingGroup = await WritingGroupService.selectVisibleWritingGroup(
      c.get("user"),
      groupId,
    );
    if (writingGroup === undefined) {
      return c.json({ error: "Group not found" }, STATUS_CODE.NotFound);
    }

    const results = await UserInWritingGroupService.selectMemberships(groupId);

    return c.json({ results }, STATUS_CODE.OK);
  },
);
