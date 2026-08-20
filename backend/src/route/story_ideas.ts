import { OpenAPIHono } from "@hono/zod-openapi";
import createStoryIdea from "./story_ideas/create_story_idea.ts";
import listStoryIdeas from "./story_ideas/list_story_ideas.ts";
import storyIdea from "./story_ideas/story_idea.ts";

export default new OpenAPIHono()
  .route("/", listStoryIdeas)
  .route("/", createStoryIdea)
  .route("/:ideaId", storyIdea);
