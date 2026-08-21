import { OpenAPIHono } from "@hono/zod-openapi";
import createStoryIdea from "./story_ideas/create_story_idea.ts";
import getCarousel from "./story_ideas/get_carousel.ts";
import listStoryIdeas from "./story_ideas/list_story_ideas.ts";
import storyIdea from "./story_ideas/story_idea.ts";

export default new OpenAPIHono()
  .route("/", listStoryIdeas)
  .route("/", createStoryIdea)
  // Before the parameter, so `/carousel` is not read as an idea id.
  .route("/", getCarousel)
  .route("/:ideaId", storyIdea);
