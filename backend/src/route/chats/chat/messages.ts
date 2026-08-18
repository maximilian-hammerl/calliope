import { OpenAPIHono } from "@hono/zod-openapi";
import listMessages from "./messages/list_messages.ts";
import createMessage from "./messages/create_message.ts";

export default new OpenAPIHono()
  .route("/", listMessages)
  .route("/", createMessage);
