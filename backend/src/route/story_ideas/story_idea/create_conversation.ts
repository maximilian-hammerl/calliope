import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { CHAT_GROUP_RESPONSE } from "@/src/http/response_schema.ts";
import { STORY_IDEAS_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { StoryIdeaService } from "@/src/service/story_idea_service.ts";
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
import { STORY_IDEA_SCHEMA } from "@/src/database/schema.ts";

const IDEA_PARAMS = z.object({ ideaId: STORY_IDEA_SCHEMA.shape.id });

export default new OpenAPIHono().openapi(
  createRoute({
    method: "post",
    path: "/conversations",
    tags: [STORY_IDEAS_TAG],
    summary: "Start a conversation about a story idea",
    description:
      "Creates a chat titled after the idea and invites its author — §11's public idea → private conversation. The author has to accept before anything is read, the same consent every chat invitation carries.",
    operationId: "startStoryIdeaConversation",
    middleware: authenticated,
    request: { params: IDEA_PARAMS },
    responses: {
      [STATUS_CODE.Created]: {
        description: "The new chat, with the author invited",
        content: jsonContent(CHAT_GROUP_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.Forbidden]: {
        description: "The reader's own idea, or one that is closed",
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
    const user = c.get("user");
    const idea = await StoryIdeaService.selectStoryIdeaGate(
      c.req.valid("param").ideaId,
    );

    if (idea === undefined) {
      return c.json({ error: "Not found" }, STATUS_CODE.NotFound);
    }
    if (idea.createdBy === user.id) {
      return c.json({ error: "Your own idea" }, STATUS_CODE.Forbidden);
    }
    // A closed idea is the author saying "don't ask" — honoured here, not only in the list.
    if (idea.status === "closed") {
      return c.json({ error: "This idea is closed" }, STATUS_CODE.Forbidden);
    }
    // Neutral on purpose: it does not say who blocked whom, only that this cannot happen.
    // Same neutral refusal for a banned author: a conversation with an account that cannot
    // sign in is one nobody can answer.
    if (
      await BlockService.isBlockedBetween(user.id, idea.createdBy) ||
      await BanService.isBanned(idea.createdBy)
    ) {
      return c.json(
        { error: "Contact is not possible" },
        STATUS_CODE.Forbidden,
      );
    }

    const chat = await ChatGroupService.insertChatGroup(
      user,
      conversationTitle("Storyidee", idea.title),
      [idea.createdBy],
    );

    return c.json(chat, STATUS_CODE.Created);
  },
);
