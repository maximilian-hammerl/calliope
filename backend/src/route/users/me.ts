import { OpenAPIHono } from "@hono/zod-openapi";
import setAvatar from "./me/set_avatar.ts";
import deleteAvatar from "./me/delete_avatar.ts";

export default new OpenAPIHono()
  .route("/", setAvatar)
  .route("/", deleteAvatar);
