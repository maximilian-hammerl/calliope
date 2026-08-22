import { OpenAPIHono } from "@hono/zod-openapi";
import listSessions from "./sessions/list_sessions.ts";
import revokeOtherSessions from "./sessions/revoke_other_sessions.ts";
import revokeSession from "./sessions/revoke_session.ts";

// `/others` before `/:sessionId`, or the literal is read as an id and only ever fails its uuid
// check.
export default new OpenAPIHono()
  .route("/", listSessions)
  .route("/others", revokeOtherSessions)
  .route("/:sessionId", revokeSession);
