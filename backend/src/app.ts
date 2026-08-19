import { OpenAPIHono } from "@hono/zod-openapi";
import { STATUS_CODE } from "@std/http/status";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { methodNotAllowed } from "hono/method-not-allowed";
import { bodyLimit } from "hono/body-limit";
import corsOptions from "./cors_options.ts";
import openApiSpecification from "./open_api_specification.ts";
import rateLimit from "./middleware/rate_limit.ts";
import { REQUEST_BODY_LIMIT_BYTES } from "./text_limit.ts";
import { type ErrorResponse } from "@/src/http/response.ts";
import auth from "./route/auth.ts";
import groups from "./route/groups.ts";
import health from "./route/health.ts";
import chats from "./route/chats.ts";
import notifications from "./route/notifications.ts";
import search from "./route/search.ts";
import users from "./route/users.ts";

// Everything the API serves, without the prefix it is mounted under. Keeping the prefix out
// of here means a resource is added in one place and cannot be mounted at the wrong depth.
const api = new OpenAPIHono({
  // Replaces the built-in handler, which stringifies the whole ZodError into `message`.
  // Inherited by routed sub-apps, so every validator reports failures the same way.
  defaultHook: (result, c) => {
    if (result.success) {
      return;
    }

    return c.json(
      {
        error: "Invalid request",
        issues: result.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      } satisfies ErrorResponse,
      STATUS_CODE.BadRequest,
    );
  },
})
  .route("/auth", auth)
  .route("/groups", groups)
  .route("/health", health)
  .route("/users", users)
  .route("/notifications", notifications)
  .route("/chats", chats)
  .route("/search", search);

const app = new OpenAPIHono();

app.use(logger());
// Before anything reads the body, so an oversized one is refused rather than buffered.
app.use(
  bodyLimit({
    maxSize: REQUEST_BODY_LIMIT_BYTES,
    onError: (c) =>
      c.json(
        { error: "Request body too large" } satisfies ErrorResponse,
        STATUS_CODE.ContentTooLarge,
      ),
  }),
);
app.use(secureHeaders());
app.use(cors(corsOptions));
app.use(methodNotAllowed({ app }));
app.use(rateLimit);

// The one place the prefix is written. Caddy routes `/api/*` here and the Vite dev proxy
// mirrors it, so both stay a single rule.
app.route("/api", api);

app.onError((error, c) => {
  // Hono and its middleware report expected failures as HTTPException, so those messages
  // are safe to pass on. Without this the response would be plain text.
  if (error instanceof HTTPException) {
    return c.json(
      { error: error.message } satisfies ErrorResponse,
      error.status,
    );
  }

  // Anything else is a bug or an outage. Log it, but never show it to the client.
  console.error(error);

  return c.json(
    { error: "Internal server error" } satisfies ErrorResponse,
    STATUS_CODE.InternalServerError,
  );
});

// Registered on the root rather than on `api`, because the document is built from the app's
// own registry: on `api` every path would be missing the prefix it is actually served under.
app.doc31("/api/openapi.json", openApiSpecification);

export default app;
