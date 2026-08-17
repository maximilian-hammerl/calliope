import { OpenAPIHono } from "@hono/zod-openapi";
import { STATUS_CODE } from "@std/http/status";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { methodNotAllowed } from "hono/method-not-allowed";
import corsOptions from "./cors_options.ts";
import openApiSpecification from "./open_api_specification.ts";
import rateLimit from "./middleware/rate_limit.ts";
import { type ErrorResponse } from "./response.ts";
import auth from "./route/auth.ts";
import groups from "./route/groups.ts";
import health from "./route/health.ts";

const app = new OpenAPIHono({
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
});

app.use(logger());
app.use(secureHeaders());
app.use(cors(corsOptions));
app.use(methodNotAllowed({ app }));
app.use(rateLimit);

app.route("/auth", auth);
app.route("/groups", groups);
app.route("/health", health);

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

app.doc31("/openapi.json", openApiSpecification);

export default app;
