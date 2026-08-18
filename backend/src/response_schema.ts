import { z } from "@hono/zod-openapi";
import {
  USER_IN_WRITING_GROUP_SCHEMA,
  USER_SCHEMA,
  WRITING_GROUP_SCHEMA,
  WRITING_POST_SCHEMA,
  WRITING_THREAD_SCHEMA,
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

export const THREAD_RESPONSE = WRITING_THREAD_SCHEMA.extend(
  CREATED_BY_USERNAME,
);

export const POST_RESPONSE = WRITING_POST_SCHEMA.extend(CREATED_BY_USERNAME);

export const MEMBERSHIP_RESPONSE = USER_IN_WRITING_GROUP_SCHEMA.extend({
  username: z.string(),
});

/**
 * What one member looks like to another. Picked rather than omitted on purpose: a column
 * added to the users table later joins this only if someone names it here, so a new private
 * field cannot leak by being forgotten.
 *
 * A username is public within the platform — it is what members type to invite one another.
 * An email address never is.
 */
export const USER_RESPONSE = USER_SCHEMA.pick({ id: true, username: true });
