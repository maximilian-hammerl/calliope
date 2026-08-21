import { OpenAPIHono } from "@hono/zod-openapi";
import deleteBlock from "./block/delete_block.ts";

// Mounted by blocks.ts at /:userId, which becomes {userId} in the OpenAPI document.
export default new OpenAPIHono().route("/", deleteBlock);
