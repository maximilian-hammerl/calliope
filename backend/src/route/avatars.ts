import { OpenAPIHono } from "@hono/zod-openapi";
import getAvatar from "./avatars/get_avatar.ts";

export default new OpenAPIHono().route("/:fileId", getAvatar);
