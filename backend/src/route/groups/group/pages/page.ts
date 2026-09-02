import { OpenAPIHono } from "@hono/zod-openapi";
import deletePage from "./page/delete_page.ts";
import getPage from "./page/get_page.ts";
import movePage from "./page/move_page.ts";
import updatePage from "./page/update_page.ts";

export default new OpenAPIHono()
  .route("/", getPage)
  .route("/", updatePage)
  .route("/", deletePage)
  .route("/folder", movePage);
