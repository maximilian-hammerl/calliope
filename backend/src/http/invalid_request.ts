import type { Context } from "hono";
import { STATUS_CODE } from "@std/http/status";
import { logger } from "@/src/logging.ts";
import type { ErrorResponse } from "@/src/http/response.ts";

type Issue = { path: string; message: string };

/**
 * The one 400 for a request that fails its schema — from a validator, or from a resolver in
 * `scope/`, which runs before the validators and so sees the raw path.
 *
 * Logged here: returning a response is not throwing, so `onError` does not fire and the log
 * would say `400` and nothing more.
 */
export function invalidRequest(c: Context, issues: Issue[]) {
  logger.warn("Invalid request", {
    method: c.req.method,
    path: c.req.path,
    issues,
  });

  return c.json(
    { error: "Invalid request", issues } satisfies ErrorResponse,
    STATUS_CODE.BadRequest,
  );
}
