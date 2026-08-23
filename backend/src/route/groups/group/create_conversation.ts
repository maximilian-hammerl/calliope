import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { CHAT_GROUP_RESPONSE } from "@/src/http/response_schema.ts";
import { GROUPS_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { WritingGroupService } from "@/src/service/writing_group_service.ts";
import { UserInWritingGroupService } from "@/src/service/user_in_writing_group_service.ts";
import { ChatGroupService } from "@/src/service/chat_group_service.ts";
import { BanService } from "@/src/service/ban_service.ts";
import { BlockService } from "@/src/service/block_service.ts";
import { conversationTitle } from "@/src/util/conversation_title.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  jsonContent,
} from "@/src/http/response.ts";
import { WRITING_GROUP_SCHEMA } from "@/src/database/schema.ts";

const GROUP_PARAMS = z.object({ groupId: WRITING_GROUP_SCHEMA.shape.id });

export default new OpenAPIHono().openapi(
  createRoute({
    method: "post",
    path: "/conversations",
    tags: [GROUPS_TAG],
    summary: "Start a conversation with a public group's administrators",
    description:
      "For asking into a group found through discovery: creates a chat titled after the group and invites every joined administrator. Each has to accept before anything is read — there is no join request, only people talking.",
    operationId: "startGroupConversation",
    middleware: authenticated,
    request: { params: GROUP_PARAMS },
    responses: {
      [STATUS_CODE.Created]: {
        description: "The new chat, with the administrators invited",
        content: jsonContent(CHAT_GROUP_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.Forbidden]: {
        description:
          "Already in the group, or already invited and holding an answerable invitation",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.NotFound]: {
        description: "No group the reader may see has this id",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.Conflict]: {
        description: "The group has no joined administrator to talk to",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const user = c.get("user");
    const group = await WritingGroupService.selectVisibleWritingGroup(
      user,
      c.req.valid("param").groupId,
    );

    // Covers the private case too: a private group is only visible with a membership.
    if (group === undefined) {
      return c.json({ error: "Not found" }, STATUS_CODE.NotFound);
    }
    // A member has the group itself to talk in, and an invited person has an invitation to
    // answer — a conversation on top would ask for what is already offered.
    if (group.status !== null) {
      return c.json(
        { error: "Already part of this group" },
        STATUS_CODE.Forbidden,
      );
    }

    // Blocked administrators are skipped rather than refused: one administrator's block must
    // not make a whole group unreachable. Only when none is left does this fail.
    // Banned administrators are skipped for the same reason and in the same way: they cannot
    // sign in, so approaching them produces a conversation nobody can answer.
    const administratorIds = await BanService.withoutBanned(
      await BlockService.withoutBlocked(
        user.id,
        await UserInWritingGroupService.selectJoinedAdministratorIds(group.id),
      ),
    );

    // The ungoverned-group hole (roadmap item 1) seen from outside: nobody left to ask.
    if (administratorIds.length === 0) {
      return c.json(
        { error: "Nobody administers this group" },
        STATUS_CODE.Conflict,
      );
    }

    const chat = await ChatGroupService.insertChatGroup(
      user,
      conversationTitle("Gruppe", group.title),
      administratorIds,
    );

    return c.json(chat, STATUS_CODE.Created);
  },
);
