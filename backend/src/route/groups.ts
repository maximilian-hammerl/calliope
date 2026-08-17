import { OpenAPIHono } from "@hono/zod-openapi";
import createGroup from "./groups/create_group.ts";
import listGroups from "./groups/list_groups.ts";
import group from "./groups/group.ts";

export default new OpenAPIHono()
  .route("/", createGroup)
  .route("/", listGroups)
  .route("/:groupId", group);
