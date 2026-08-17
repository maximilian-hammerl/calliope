import { z } from "@hono/zod-openapi";

/** Shared by both removal endpoints, so a client learns the same thing either way. */
export const MEMBERSHIP_REMOVAL_RESPONSE = z.object({
  ok: z.literal(true),
  // A group exists only for its members, so removing the last one deletes it.
  writingGroupDeleted: z.boolean(),
});
