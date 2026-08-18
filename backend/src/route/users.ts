import { OpenAPIHono } from "@hono/zod-openapi";
import listUsers from "./users/list_users.ts";

export default new OpenAPIHono().route("/", listUsers);
