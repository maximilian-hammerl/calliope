import { z } from "@hono/zod-openapi";
import {
  NOTIFICATION_SCHEMA,
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
  /** Null for a group's founder, and once the inviter's account is gone. */
  invitedByUsername: z.string().nullable(),
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

/**
 * A notification as the interface needs it, discriminated on `type` so each kind carries the
 * subjects it is about and nothing else — the CHECK constraint on the table, expressed in the
 * contract. The titles and the name are joined at read time rather than stored, so a renamed
 * group renames everywhere and nothing survives the reader losing access to it.
 */
/**
 * What every notification has, whatever it is about. The group is deliberately *not* here:
 * the types that exist today all belong to one, but the requirements describe private
 * messages, moderation notices and system announcements, and none of those does. Keeping the
 * group on the variants that have one means those can be added without loosening this.
 */
const NOTIFICATION_BASE = {
  ...NOTIFICATION_SCHEMA.pick({
    id: true,
    occurredAt: true,
    readAt: true,
  }).shape,
  actorUsername: z.string().nullable(),
};

const GROUP_SUBJECT = {
  writingGroupId: NOTIFICATION_SCHEMA.shape.writingGroupId,
  writingGroupTitle: z.string(),
};

const THREAD_SUBJECT = {
  writingThreadId: NOTIFICATION_SCHEMA.shape.writingThreadId.unwrap(),
  writingThreadTitle: z.string(),
};

export const NOTIFICATION_RESPONSE = z.discriminatedUnion("type", [
  z.object({
    ...NOTIFICATION_BASE,
    ...GROUP_SUBJECT,
    type: z.literal("invited_to_writing_group"),
  }),
  z.object({
    ...NOTIFICATION_BASE,
    ...GROUP_SUBJECT,
    type: z.literal("invitation_accepted"),
  }),
  z.object({
    ...NOTIFICATION_BASE,
    ...GROUP_SUBJECT,
    type: z.literal("visibility_changed_in_writing_group"),
    /** What the group is now — joined, like the role, because one row holds the latest. */
    visibility: WRITING_GROUP_SCHEMA.shape.visibility,
  }),
  z.object({
    ...NOTIFICATION_BASE,
    ...GROUP_SUBJECT,
    type: z.literal("role_changed_in_writing_group"),
    /** The recipient's role now, which for this type is what the change was. */
    role: USER_IN_WRITING_GROUP_SCHEMA.shape.role,
  }),
  z.object({
    ...NOTIFICATION_BASE,
    ...GROUP_SUBJECT,
    ...THREAD_SUBJECT,
    type: z.literal("new_writing_thread"),
  }),
  z.object({
    ...NOTIFICATION_BASE,
    ...GROUP_SUBJECT,
    ...THREAD_SUBJECT,
    type: z.literal("new_writing_post"),
    writingPostId: NOTIFICATION_SCHEMA.shape.writingPostId.unwrap(),
  }),
]);
