import { z } from "@hono/zod-openapi";
import {
  POST_SCHEMA,
  THREAD_SCHEMA,
  USER_IN_WRITING_GROUP_SCHEMA,
  WRITING_GROUP_SCHEMA,
} from "@/src/database/schema.ts";

/**
 * What the API returns for each resource: the table's own columns plus the name behind the
 * user id. The name is joined rather than stored, so it follows a rename, and every client
 * would otherwise have to resolve ids itself to show who wrote something.
 *
 * Null wherever the author's account has been deleted — `created_by` is ON DELETE SET NULL,
 * so the writing outlives the account. A membership cannot outlive its user, so there the
 * name is always present.
 */
const CREATED_BY_USERNAME = {
  createdByUsername: z.string().nullable(),
};

export const GROUP_RESPONSE = WRITING_GROUP_SCHEMA.extend(CREATED_BY_USERNAME);

export const THREAD_RESPONSE = THREAD_SCHEMA.extend(CREATED_BY_USERNAME);

export const POST_RESPONSE = POST_SCHEMA.extend(CREATED_BY_USERNAME);

export const MEMBERSHIP_RESPONSE = USER_IN_WRITING_GROUP_SCHEMA.extend({
  username: z.string(),
});
