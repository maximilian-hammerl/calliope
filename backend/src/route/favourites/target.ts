import { OpenAPIHono } from "@hono/zod-openapi";
import setFavourite from "./target/set_favourite.ts";
import clearFavourite from "./target/clear_favourite.ts";

export default new OpenAPIHono()
  .route("/", setFavourite)
  .route("/", clearFavourite);
