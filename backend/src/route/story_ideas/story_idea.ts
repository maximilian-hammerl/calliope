import { OpenAPIHono } from "@hono/zod-openapi";
import clearRead from "./story_idea/clear_read.ts";
import createConversation from "./story_idea/create_conversation.ts";
import deleteStoryIdea from "./story_idea/delete_story_idea.ts";
import getStoryIdea from "./story_idea/get_story_idea.ts";
import markRead from "./story_idea/mark_read.ts";
import updateStoryIdea from "./story_idea/update_story_idea.ts";

export default new OpenAPIHono()
  .route("/", getStoryIdea)
  .route("/", updateStoryIdea)
  .route("/", deleteStoryIdea)
  .route("/", createConversation)
  .route("/", markRead)
  .route("/", clearRead);
