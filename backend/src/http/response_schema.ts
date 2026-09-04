import { z } from "@hono/zod-openapi";
import {
  CHAT_GROUP_SCHEMA,
  CHAT_MESSAGE_SCHEMA,
  FORUM_PERMISSION_SCHEMA,
  NOTIFICATION_SCHEMA,
  STORY_IDEA_SCHEMA,
  USER_IN_CHAT_GROUP_SCHEMA,
  USER_IN_WRITING_GROUP_SCHEMA,
  USER_SCHEMA,
  USER_SESSION_SCHEMA,
  WRITING_FOLDER_SCHEMA,
  WRITING_GROUP_NEXT_STEP_SCHEMA,
  WRITING_GROUP_SCHEMA,
  WRITING_PAGE_SCHEMA,
  WRITING_POST_SCHEMA,
  WRITING_THREAD_SCHEMA,
} from "@/src/database/schema.ts";
import { DOCUMENT_SCHEMA } from "@/src/document/document_schema.ts";

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

/**
 * A group plus the reader's own standing in it, the way a chat already reports it. Without
 * this the interface cannot tell a group somebody belongs to from a public one they have
 * merely stumbled on, and has to read its own role out of the member list.
 *
 * Both are null for a public group the reader is not part of. Role is stated even while an
 * invitation is pending, because the invitation names the role being offered — whether it
 * may be acted on is decided by the status, never by the role alone.
 */
const OWN_MEMBERSHIP = {
  status: USER_IN_WRITING_GROUP_SCHEMA.shape.status.nullable(),
  role: USER_IN_WRITING_GROUP_SCHEMA.shape.role.nullable(),
  /** When the reader was asked, which is what an invitations list is sorted and dated by. */
  invitedAt: USER_IN_WRITING_GROUP_SCHEMA.shape.invitedAt.nullable(),
};

/**
 * The reader's own favourite, on every kind that has one. Extended in rather than picked from a
 * table, because it is a fact about the reader and the thing rather than about the thing —
 * `favourite` holds it, and nobody else's is ever visible here.
 */
export const OWN_FAVOURITE = { isFavourite: z.boolean() };

export const GROUP_RESPONSE = WRITING_GROUP_SCHEMA
  .extend(CREATED_BY_USERNAME)
  .extend(OWN_MEMBERSHIP)
  .extend(OWN_FAVOURITE);

/**
 * The three tables a writing group shares with the public forum (#32) carry a `writing_group_id`
 * that is null for a forum row and a permission that is null for a group one. A group's responses
 * have neither shape: the scope is the group in the path, so the id is present, and the permission
 * is the forum's alone.
 */
const IN_GROUP = { writingGroupId: z.uuidv7() };

export const THREAD_RESPONSE = WRITING_THREAD_SCHEMA
  .omit({ memberPermission: true })
  .extend(IN_GROUP)
  .extend(CREATED_BY_USERNAME)
  .extend(OWN_FAVOURITE);

export const POST_RESPONSE = WRITING_POST_SCHEMA.extend(CREATED_BY_USERNAME)
  .extend(OWN_FAVOURITE)
  .extend({
    // The generated column is `z.unknown()`, which would reach the client as `unknown`.
    document: DOCUMENT_SCHEMA,
    /**
     * Who changed it, which is not implied by the row: `mayModify` lets the author or somebody
     * administering the group edit. Null when nothing has been edited, and null once that
     * account is gone, exactly like the author's name above.
     */
    editedByUsername: z.string().nullable(),
  });

/**
 * The public forum's rows (#32). No `writingGroupId` — it is null on every one of them — and one
 * permission in place of the two columns: what this member may do here, already reduced along the
 * path, with `write` for an operator. The folder's own setting is not sent: nothing reads it until
 * there is a surface for changing it.
 */
const FORUM_PERMISSION = {
  effectiveMemberPermission: FORUM_PERMISSION_SCHEMA,
};

/**
 * Both permissions, unlike a leaf's: the reduced one is what a reader is told, and the folder's
 * *own* setting is what an operator's dialog has to show — a room closed by the room above it
 * still remembers what was chosen for it (#32's slice 7).
 */
export const FORUM_FOLDER_RESPONSE = WRITING_FOLDER_SCHEMA
  .omit({ writingGroupId: true })
  .extend(CREATED_BY_USERNAME)
  .extend(FORUM_PERMISSION)
  // Not nullable here, unlike the column: it is null only for a writing group's folder, which the
  // table's CHECK requires and `forumFolders`' `$narrowType` asserts.
  .extend({ memberPermission: FORUM_PERMISSION_SCHEMA });

export const FORUM_THREAD_RESPONSE = WRITING_THREAD_SCHEMA
  .omit({ writingGroupId: true })
  .extend(CREATED_BY_USERNAME)
  .extend(OWN_FAVOURITE)
  .extend(FORUM_PERMISSION)
  .extend({ memberPermission: FORUM_PERMISSION_SCHEMA });

export const FORUM_PAGE_SUMMARY_RESPONSE = WRITING_PAGE_SCHEMA
  .omit({ writingGroupId: true, document: true, text: true })
  .extend(CREATED_BY_USERNAME)
  .extend(OWN_FAVOURITE)
  .extend({ memberPermission: FORUM_PERMISSION_SCHEMA })
  .extend({ updatedByUsername: z.string().nullable() })
  .extend(FORUM_PERMISSION);

// `text` stays server-side here for the same reason it does in a group: it exists for search.
export const FORUM_PAGE_RESPONSE = FORUM_PAGE_SUMMARY_RESPONSE
  .extend({ document: DOCUMENT_SCHEMA });

/**
 * A path, resolved against this API's own origin — never absolute, so it cannot point at another
 * host and needs no `HOST_URL` to be right. Null where a member has set no picture, which is most
 * of them; the interface shows their initial instead.
 */
export const AVATAR_URL = z.string().nullable();

export const MEMBERSHIP_RESPONSE = USER_IN_WRITING_GROUP_SCHEMA.extend({
  /** Null for a group's founder, and once the inviter's account is gone. */
  invitedByUsername: z.string().nullable(),
  username: z.string(),
  avatarUrl: AVATAR_URL,
});

/** A folder as the tree reads it. `depth` is derived by the server and never sent by a client. */
export const FOLDER_RESPONSE = WRITING_FOLDER_SCHEMA
  .omit({ memberPermission: true, effectiveMemberPermission: true })
  .extend(IN_GROUP)
  .extend(CREATED_BY_USERNAME);

/**
 * A page without its prose, for the tree. `lastActivityAt` is also what an edit is conditional
 * on, so the client has to keep the value it loaded.
 */
export const PAGE_SUMMARY_RESPONSE = WRITING_PAGE_SCHEMA
  .omit({ document: true, text: true, memberPermission: true })
  .extend(IN_GROUP)
  .extend(CREATED_BY_USERNAME)
  .extend(OWN_FAVOURITE)
  .extend({ updatedByUsername: z.string().nullable() });

// `text` stays server-side: it exists for search, and the client renders the document.
export const PAGE_RESPONSE = PAGE_SUMMARY_RESPONSE
  .extend({ document: DOCUMENT_SCHEMA });

/**
 * What one member looks like to another. Picked rather than omitted on purpose: a column
 * added to the users table later joins this only if someone names it here, so a new private
 * field cannot leak by being forgotten.
 *
 * A username is public within the platform — it is what members type to invite one another.
 * An email address never is.
 */
export const NEXT_STEP_RESPONSE = WRITING_GROUP_NEXT_STEP_SCHEMA
  .pick({
    id: true,
    writingGroupId: true,
    text: true,
    createdBy: true,
    completedAt: true,
    completedBy: true,
    createdAt: true,
  })
  .extend({
    createdByUsername: z.string().nullable(),
    completedByUsername: z.string().nullable(),
  });

export const USER_RESPONSE = USER_SCHEMA
  .pick({ id: true, username: true })
  .extend({ avatarUrl: AVATAR_URL });

/**
 * The members list, and nowhere else a person is merely mentioned. A role is a fact about
 * somebody, not a decoration on every reference to them — see #101, which keeps it off post
 * bylines and out of `USER_RESPONSE`, where the picker and search would inherit it.
 */
export const LISTED_MEMBER_RESPONSE = USER_RESPONSE
  .extend({ platformRole: USER_SCHEMA.shape.platformRole });

/**
 * One of a member's own sessions. `lastUsedAt` is derived rather than stored: every request
 * within the refresh interval pushes `expires_at` to now plus the lifetime, so subtracting the
 * lifetime gives the last use to within that interval.
 *
 * `device` is a coarse label and `ipAddress` the address the session was opened from. Both are
 * only ever shown to the member they belong to.
 */
export const SESSION_RESPONSE = z.object({
  id: USER_SESSION_SCHEMA.shape.id,
  // The stored user agent, parsed. Any part is null for a client the parser cannot read.
  browser: z.string().nullable(),
  operatingSystem: z.string().nullable(),
  deviceType: z.string().nullable(),
  vendor: z.string().nullable(),
  ipAddress: USER_SESSION_SCHEMA.shape.ipAddress,
  createdAt: USER_SESSION_SCHEMA.shape.createdAt,
  lastUsedAt: z.string(),
  /** The one asking. It is the only session a member can be sure about. */
  current: z.boolean(),
});

/** The author's name joined on, never null: an idea cannot outlive its author (CASCADE). */
export const STORY_IDEA_RESPONSE = STORY_IDEA_SCHEMA.extend({
  createdByUsername: z.string(),
  // The requesting member's own state, null while unread. Never another member's: a count of
  // readers is exactly the statistic the research rejected.
  // Read is the presence of a row, so it reaches the client as the fact it is rather than as
  // a nullable enum. Favouriting is `isFavourite`, and no longer the same column.
  isRead: z.boolean(),
  ...OWN_FAVOURITE,
});

/**
 * One step of the story-idea carousel. The neighbours are whole ideas rather than ids, because
 * a movement needs something to move to; `null` on a side is the end of the set. `storyIdea`
 * is null only when the set is empty, which is a member who has read everything.
 */
export const STORY_IDEA_CAROUSEL_RESPONSE = z.object({
  previous: STORY_IDEA_RESPONSE.nullable(),
  storyIdea: STORY_IDEA_RESPONSE.nullable(),
  next: STORY_IDEA_RESPONSE.nullable(),
  total: z.number().int().nonnegative(),
});

/**
 * Separate from `USER_RESPONSE` so the picker and search keep sending two fields. The profile
 * goes to every member: there is no visibility setting, only the choice to leave a field empty.
 */
export const USER_PROFILE_RESPONSE = USER_SCHEMA.pick({
  id: true,
  username: true,
  createdAt: true,
  // Null is the ordinary member, which is most of them.
  platformRole: true,
  aboutMe: true,
  writingStyle: true,
  postLength: true,
  writingFrequency: true,
  coWriterExpectations: true,
  writingBoundaries: true,
  genres: true,
}).extend({
  // Whether the *reader* has blocked them, which is the reader's own information. Never
  // whether they have blocked the reader: that would be the disclosure a neutral 403 avoids.
  isBlocked: z.boolean(),
  avatarUrl: AVATAR_URL,
  // Present only for an operator, and absent for everybody else rather than false: a ban is
  // the platform acting, and telling one member that another was banned is not this page's
  // business. Operators need it because the control that bans must also be able to lift.
  isBanned: z.boolean().optional(),
});

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

const PAGE_SUBJECT = {
  writingPageId: NOTIFICATION_SCHEMA.shape.writingPageId.unwrap(),
  writingPageTitle: z.string(),
};

/**
 * A notification as the interface needs it, discriminated on `type` so each kind carries the
 * subjects it is about and nothing else — the CHECK constraint on the table, expressed in the
 * contract. The titles and the name are joined at read time rather than stored, so a renamed
 * group renames everywhere and nothing survives the reader losing access to it.
 */
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
  z.object({
    ...NOTIFICATION_BASE,
    ...GROUP_SUBJECT,
    ...PAGE_SUBJECT,
    // A page belongs to its group, not to a thread, so it carries no thread subject.
    type: z.literal("new_writing_page"),
  }),
  z.object({
    ...NOTIFICATION_BASE,
    type: z.literal("invited_to_chat_group"),
    chatGroupId: NOTIFICATION_SCHEMA.shape.chatGroupId.unwrap(),
    chatGroupTitle: z.string(),
  }),
]);

/** A chat as its list entry: the group, its founder's name, and this member's unread count. */
export const CHAT_GROUP_RESPONSE = CHAT_GROUP_SCHEMA.extend({
  ...OWN_FAVOURITE,
  /** The reader's own standing in it, so the interface knows whether to show a conversation. */
  status: USER_IN_CHAT_GROUP_SCHEMA.shape.status,
  createdByUsername: z.string().nullable(),
  unreadMessages: z.number().int(),
});

export const CHAT_MESSAGE_RESPONSE = CHAT_MESSAGE_SCHEMA.extend({
  createdByUsername: z.string().nullable(),
});

export const CHAT_MEMBERSHIP_RESPONSE = USER_IN_CHAT_GROUP_SCHEMA
  .pick({
    userId: true,
    chatGroupId: true,
    status: true,
    invitedAt: true,
    joinedAt: true,
  })
  .extend({ username: z.string(), avatarUrl: AVATAR_URL });

/**
 * A thread found by a search carries the title of its group. A result that can come from
 * anywhere has to say where it came from — „Plot" alone is meaningless when it could be from
 * any group, which is the same reason a notification about a post names both.
 */
export const FOUND_THREAD_RESPONSE = THREAD_RESPONSE
  .extend({ writingGroupTitle: z.string() });

/**
 * A page as search returns it: the summary, without its prose. The body is what the term may
 * have matched, but the row shows a title like every other kind's.
 */
export const FOUND_PAGE_RESPONSE = PAGE_SUMMARY_RESPONSE
  .extend({ writingGroupTitle: z.string() });
