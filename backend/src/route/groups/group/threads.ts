import { OpenAPIHono } from "@hono/zod-openapi";
import createThread from "./threads/create_thread.ts";
import listThreads from "./threads/list_threads.ts";
import thread from "./threads/thread.ts";

export default new OpenAPIHono()
  .route("/", createThread)
  .route("/", listThreads)
  .route("/:threadId", thread);
