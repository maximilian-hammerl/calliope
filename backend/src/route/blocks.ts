import { OpenAPIHono } from "@hono/zod-openapi";
import createBlock from "./blocks/create_block.ts";
import listBlocks from "./blocks/list_blocks.ts";
import block from "./blocks/block.ts";

export default new OpenAPIHono()
  .route("/", listBlocks)
  .route("/", createBlock)
  .route("/:userId", block);
