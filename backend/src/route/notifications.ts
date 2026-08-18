import { OpenAPIHono } from "@hono/zod-openapi";
import listNotifications from "./notifications/list_notifications.ts";
import readNotifications from "./notifications/read_notifications.ts";

export default new OpenAPIHono()
  .route("/", listNotifications)
  .route("/read", readNotifications);
