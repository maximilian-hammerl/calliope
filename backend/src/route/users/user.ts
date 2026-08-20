import { OpenAPIHono } from "@hono/zod-openapi";
import getUser from "./user/get_user.ts";

export default new OpenAPIHono().route("/", getUser);
