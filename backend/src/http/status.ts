/** The status codes this API answers with, by their HTTP names. Add one here before using it. */
export const STATUS_CODE = {
  OK: 200,
  Created: 201,
  BadRequest: 400,
  Unauthorized: 401,
  Forbidden: 403,
  NotFound: 404,
  MethodNotAllowed: 405,
  Conflict: 409,
  Gone: 410,
  ContentTooLarge: 413,
  UnsupportedMediaType: 415,
  UnprocessableEntity: 422,
  TooManyRequests: 429,
  InternalServerError: 500,
  ServiceUnavailable: 503,
} as const;
