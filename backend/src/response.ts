import { z } from "@hono/zod-openapi";
import { STATUS_CODE } from "@std/http/status";

/**
 * Every declared response needs a content schema. A content-less one widens the handler's
 * return type to plain `Response`, which silently disables the compile-time body and status
 * checks for the whole route.
 */
export function jsonContent<T extends z.ZodType>(schema: T) {
  return { "application/json": { schema } };
}

export const OK_RESPONSE = z.object({ ok: z.literal(true) });

/**
 * The single error shape for every failure the API reports. `issues` is only filled in for
 * schema violations, so that one contract covers validation errors and everything else.
 */
export const ERROR_RESPONSE = z.object({
  error: z.string(),
  issues: z.array(z.object({
    path: z.string(),
    message: z.string(),
  })).optional(),
});

export type ErrorResponse = z.infer<typeof ERROR_RESPONSE>;

/**
 * Produced by the body limit, the rate limiter and the global error handler, so every route
 * can return them regardless of what its own handler does.
 */
export const COMMON_RESPONSES = {
  [STATUS_CODE.ContentTooLarge]: {
    description: "Request body too large",
    content: jsonContent(ERROR_RESPONSE),
  },
  [STATUS_CODE.TooManyRequests]: {
    description: "Rate limit exceeded",
    content: jsonContent(ERROR_RESPONSE),
  },
  [STATUS_CODE.InternalServerError]: {
    description: "Unexpected failure",
    content: jsonContent(ERROR_RESPONSE),
  },
} as const;

/** Returned by the validator whenever a request fails its schema. */
export const BAD_REQUEST_RESPONSE = {
  [STATUS_CODE.BadRequest]: {
    description: "Invalid request",
    content: jsonContent(ERROR_RESPONSE),
  },
} as const;
