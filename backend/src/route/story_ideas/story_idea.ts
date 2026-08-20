import { OpenAPIHono } from "@hono/zod-openapi";
import deleteStoryIdea from "./story_idea/delete_story_idea.ts";
import getStoryIdea from "./story_idea/get_story_idea.ts";
import updateStoryIdea from "./story_idea/update_story_idea.ts";

export default new OpenAPIHono()
  .route("/", getStoryIdea)
  .route("/", updateStoryIdea)
  .route("/", deleteStoryIdea);
