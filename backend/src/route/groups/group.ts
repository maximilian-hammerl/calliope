import { OpenAPIHono } from "@hono/zod-openapi";
import createConversation from "./group/create_conversation.ts";
import getGroup from "./group/get_group.ts";
import updateGroup from "./group/update_group.ts";
import folders from "./group/folders.ts";
import memberships from "./group/memberships.ts";
import pages from "./group/pages.ts";
import steps from "./group/steps.ts";
import threads from "./group/threads.ts";

// Mounted by groups.ts at /:groupId, which becomes {groupId} in the OpenAPI document.
export default new OpenAPIHono()
  .route("/", getGroup)
  .route("/", updateGroup)
  .route("/", createConversation)
  .route("/folders", folders)
  .route("/memberships", memberships)
  .route("/pages", pages)
  .route("/steps", steps)
  .route("/threads", threads);
