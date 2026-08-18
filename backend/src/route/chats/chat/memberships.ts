import { OpenAPIHono } from "@hono/zod-openapi";
import createChatMembership from "./memberships/create_chat_membership.ts";
import listChatMemberships from "./memberships/list_chat_memberships.ts";
import me from "./memberships/me.ts";

export default new OpenAPIHono()
  .route("/", createChatMembership)
  .route("/", listChatMemberships)
  .route("/me", me);
