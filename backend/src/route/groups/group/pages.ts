import { OpenAPIHono } from "@hono/zod-openapi";
import createPage from "./pages/create_page.ts";
import listPages from "./pages/list_pages.ts";
import page from "./pages/page.ts";

export default new OpenAPIHono()
  .route("/", createPage)
  .route("/", listPages)
  .route("/:pageId", page);
