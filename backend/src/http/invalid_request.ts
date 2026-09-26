import type { Context } from "hono";
import { STATUS_CODE } from "@std/http/status";
import { logger } from "@/src/logging.ts";
import type { ErrorResponse } from "@/src/http/response.ts";

type Issue = { path: string; message: string };

/**
 * The one 400 for a request failing its schema, from a validator or a resolver in `scope/`.
 * Logged here: a returned response never reaches `onError`.
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
