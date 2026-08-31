import { OpenAPIHono } from "@hono/zod-openapi";
import { structuredLogger } from "@hono/structured-logger";
import { STATUS_CODE, STATUS_TEXT } from "@std/http/status";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { methodNotAllowed } from "hono/method-not-allowed";
import { bodyLimit } from "hono/body-limit";
import corsOptions from "./cors_options.ts";
import { describeError, logger } from "@/src/logging.ts";
import openApiSpecification from "./open_api_specification.ts";
import { readRateLimit, writeRateLimit } from "./middleware/rate_limit.ts";
import {
  REQUEST_BODY_LIMIT_BYTES,
  UPLOAD_BODY_LIMIT_BYTES,
} from "./text_limit.ts";
import { type ErrorResponse } from "@/src/http/response.ts";
import auth from "./route/auth.ts";
import groups from "./route/groups.ts";
import health from "./route/health.ts";
import chats from "./route/chats.ts";
import notifications from "./route/notifications.ts";
import search from "./route/search.ts";
import storyIdeas from "./route/story_ideas.ts";
import blocks from "@/src/route/blocks.ts";
import reports from "@/src/route/reports.ts";
import favourites from "@/src/route/favourites.ts";
import users from "./route/users.ts";
import avatars from "./route/avatars.ts";

// Everything the API serves, without the prefix it is mounted under. Keeping the prefix out
// of here means a resource is added in one place and cannot be mounted at the wrong depth.
const api = new OpenAPIHono({
  // Replaces the built-in handler, which stringifies the whole ZodError into `message`.
  // Inherited by routed sub-apps, so every validator reports failures the same way.
  defaultHook: (result, c) => {
    if (result.success) {
      return;
    }

    const issues = result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));

    // Here rather than in the request middleware, which never sees this: returning a response is
    // not throwing, so `onError` does not fire and the log would say `400` and nothing more.
    logger.warn("Invalid request", {
      method: c.req.method,
      path: c.req.path,
      issues,
    });

    return c.json(
      { error: "Invalid request", issues } satisfies ErrorResponse,
      STATUS_CODE.BadRequest,
    );
  },
})
  .route("/auth", auth)
  .route("/groups", groups)
  .route("/health", health)
  .route("/story-ideas", storyIdeas)
  .route("/blocks", blocks)
  .route("/reports", reports)
  .route("/favourites", favourites)
  .route("/users", users)
  .route("/avatars", avatars)
  .route("/notifications", notifications)
  .route("/chats", chats)
  .route("/search", search);

const app = new OpenAPIHono();

app.use(structuredLogger({
  createLogger: () => logger,
  // One line per request, not two: nothing tied an "incoming" line to its "completed" one, so a
  // status could not be read back to the route that produced it.
  onResponse: (requestLogger, c, elapsed) => {
    const request = {
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs: Math.round(elapsed),
    };

    // Polled every ten seconds, so `info` would be 8,640 lines a day. `trace`, not `debug`: the
    // deployed instance runs as `testing`. A 503 still logs — that is a restart about to happen.
    if (c.req.path === "/api/health" && c.res.status === STATUS_CODE.OK) {
      requestLogger.trace("Request", request);
      return;
    }

    requestLogger.info("Request", request);
  },
  onError: (requestLogger, error, c, elapsed) => {
    const request = {
      method: c.req.method,
      path: c.req.path,
      durationMs: Math.round(elapsed),
    };

    // How Hono reports an expected refusal — 401, 413, 429. No stack: there is no bug to find,
    // and one per unauthenticated request would bury the errors that matter.
    if (error instanceof HTTPException) {
      requestLogger.warn("Request refused", {
        ...request,
        status: error.status,
        reason: error.message,
      });
      return;
    }

    requestLogger.error("Request failed", {
      ...request,
      status: STATUS_CODE.InternalServerError,
      ...describeError(error),
    });
  },
}));
// Before anything reads the body, so an oversized one is refused rather than buffered.
//
// The limit is chosen here rather than declared on the upload route, because this middleware runs
// first and refuses before route middleware is reached — a larger limit written on the route never
// executes at all.
app.use((c, next) =>
  bodyLimit({
    maxSize: c.req.path.endsWith("/avatar") && c.req.method === "PUT"
      ? UPLOAD_BODY_LIMIT_BYTES
      : REQUEST_BODY_LIMIT_BYTES,
    onError: (c) =>
      c.json(
        { error: "Request body too large" } satisfies ErrorResponse,
        STATUS_CODE.ContentTooLarge,
      ),
  })(c, next)
);
app.use(secureHeaders());
app.use(cors(corsOptions));
app.use(methodNotAllowed({ app }));
// After `cors`, which answers preflights and returns: a preflight is cross-site by nature
// and carries no content type, so this would otherwise refuse it as a forgery.
app.use(csrf({ origin: corsOptions.origin }));
// Two budgets, split by method; each skips what the other counts.
app.use(readRateLimit);
app.use(writeRateLimit);

// The one place the prefix is written. Caddy routes `/api/*` here and the Vite dev proxy
// mirrors it, so both stay a single rule.
app.route("/api", api);

/** `STATUS_TEXT` is keyed by the codes it knows; Hono's status type includes ones it does not. */
const STATUS_NAME: Record<number, string> = STATUS_TEXT;

app.onError((error, c) => {
  // Hono and its middleware report expected failures as HTTPException, so those messages
  // are safe to pass on. Without this the response would be plain text.
  if (error instanceof HTTPException) {
    // A refusal that built its own JSON body keeps it, so a rule enforced in a service can answer
    // in the same `{error, issues}` shape as one enforced by a schema — `defaultHook` produces
    // that shape and a client should not have to read two. `csrf()` also throws carrying a
    // response, but not a JSON one, so it still falls through to the name below.
    const carried = error.res;

    if (carried?.headers.get("content-type")?.includes("application/json")) {
      return carried;
    }

    return c.json(
      // `csrf()` throws carrying a response rather than a message, so an empty one needs a name.
      {
        error: error.message || STATUS_NAME[error.status] || "Error",
      } satisfies ErrorResponse,
      error.status,
    );
  }

  // Anything else is a bug or an outage. The request middleware has already logged it with its
  // stack, so this only decides what the client is told.
  return c.json(
    { error: "Internal server error" } satisfies ErrorResponse,
    STATUS_CODE.InternalServerError,
  );
});

// Registered on the root rather than on `api`, because the document is built from the app's
// own registry: on `api` every path would be missing the prefix it is actually served under.
app.doc31("/api/openapi.json", openApiSpecification);

export default app;
