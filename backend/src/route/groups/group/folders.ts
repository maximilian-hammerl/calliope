import { OpenAPIHono } from "@hono/zod-openapi";
import createFolder from "./folders/create_folder.ts";
import listFolders from "./folders/list_folders.ts";
import folder from "./folders/folder.ts";

export default new OpenAPIHono()
  .route("/", createFolder)
  .route("/", listFolders)
  .route("/:folderId", folder);
