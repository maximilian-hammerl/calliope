import { OpenAPIHono } from "@hono/zod-openapi";
import memberships from "./chat/memberships.ts";
import messages from "./chat/messages.ts";
import readChat from "./chat/read_chat.ts";

export default new OpenAPIHono()
  .route("/memberships", memberships)
  .route("/messages", messages)
  .route("/read", readChat);
