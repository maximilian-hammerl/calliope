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
 * The one thing a client has to tell apart from a lost session: a 401 meaning the password it
 * just sent was wrong. This value is a contract — the message beside it is not, and may be
 * reworded freely.
 */
export const INVALID_CREDENTIALS = "invalid_credentials" as const;

export const INVALID_CREDENTIALS_MESSAGE = "Invalid credentials" as const;

/** Machine-readable reasons, for the few a client has to act on differently. */
const ERROR_CODE = z.enum([INVALID_CREDENTIALS]);

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
  code: ERROR_CODE.optional(),
});

export type ErrorResponse = z.infer<typeof ERROR_RESPONSE>;

/**
 * The body for a wrong password — signing in, or re-authenticating with a valid session. Always
 * this constant: the frontend signs a member out on any 401 it cannot account for, so answering
 * one without the code closes their dialog and loses what they typed.
 *
 * A constant rather than a helper returning `c.json(...)`, because a helper's `Response` widens
 * the handler's return type and switches off the body and status checks for the whole route.
 */
export const INVALID_CREDENTIALS_BODY = {
  error: INVALID_CREDENTIALS_MESSAGE,
  code: INVALID_CREDENTIALS,
} as const;

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

/**
 * Returned by the session middleware when the address behind an otherwise good session has
 * not been verified. Routes that also refuse for a reason of their own declare their own 403
 * with a description saying which, and do not spread this.
 */
export const FORBIDDEN_RESPONSE = {
  [STATUS_CODE.Forbidden]: {
    description: "Email address not verified",
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
