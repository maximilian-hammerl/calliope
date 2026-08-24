import { OpenAPIHono } from "@hono/zod-openapi";
import target from "./favourites/target.ts";

export default new OpenAPIHono().route("/:targetType/:targetId", target);
