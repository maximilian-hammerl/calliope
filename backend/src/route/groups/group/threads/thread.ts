import { OpenAPIHono } from "@hono/zod-openapi";
import deleteThread from "./thread/delete_thread.ts";
import getThread from "./thread/get_thread.ts";
import moveThread from "./thread/move_thread.ts";
import posts from "./thread/posts.ts";
import updateThread from "./thread/update_thread.ts";

// Mounted by threads.ts at /:threadId.
export default new OpenAPIHono()
  .route("/", getThread)
  .route("/", updateThread)
  .route("/", deleteThread)
  .route("/posts", posts)
  .route("/folder", moveThread);
