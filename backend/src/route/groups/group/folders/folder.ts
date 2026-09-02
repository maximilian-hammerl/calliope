import { OpenAPIHono } from "@hono/zod-openapi";
import deleteFolder from "./folder/delete_folder.ts";
import moveFolder from "./folder/move_folder.ts";
import updateFolder from "./folder/update_folder.ts";

export default new OpenAPIHono()
  .route("/", updateFolder)
  .route("/", deleteFolder)
  .route("/parent", moveFolder);
