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

/**
 * The document is typed loosely on the way out and strictly on the way in — nothing can be
 * stored that the whitelist in `document.ts` did not accept, so what comes back is already
 * known to be safe. It is declared here rather than inherited from the generated schema
 * because `z.unknown()` makes the key optional, and Hono's response inference gives up on the
 * resulting route type with "type instantiation is excessively deep".
 */
export const POST_RESPONSE = z.object({
  ...WRITING_POST_SCHEMA.shape,
  ...CREATED_BY_USERNAME,
  // Loose on the way out and strict on the way in: nothing can be stored that the whitelist
  // in `document.ts` refused, so what comes back is already known to be safe. Spread into a
  // flat object rather than chained through `.extend()` — this route's type sits close to
  // TypeScript's instantiation ceiling, and the chain is what tips it over.
  // `any`, and deliberately so. Every other type — `unknown`, `json`, even `string` — pushes
  // this route's inference past TypeScript's instantiation ceiling ("excessively deep"), and
  // `any` is the one that short-circuits it. Nothing is lost: the document was validated
  // against the whitelist in `document.ts` before it could be stored, so what comes back out
  // is already known to be safe. The strictness that matters is on the way in.
  document: z.any().openapi({
    type: "object",
    description: "A ProseMirror document",
  }),
});

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
