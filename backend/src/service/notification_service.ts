import { z } from "@hono/zod-openapi";
import type {
  NotificationType,
  WritingGroupVisibility,
} from "@/src/database/schema.ts";
import { db, type Transaction } from "@/src/database/client.ts";
import { assertUnreachable } from "@/src/util/assert_unreachable.ts";
import { NOTIFICATION_RESPONSE } from "@/src/http/response_schema.ts";
import type { UserInWritingGroupRole } from "@/src/database/schema.ts";
import {
  type ListQuery,
  type ListResults,
  listResultsWithCount,
} from "@/src/list/list_endpoint_query.ts";

/**
 * A notification is stored as the event that happened, never as the sentence describing it.
 * The wording belongs to the interface and may change; a stored sentence would also freeze a
 * private group's title into a row and keep showing it after the reader lost access.
 *
 * Everything the sentence needs is joined at read time instead, which is also what keeps it
 * honest: a renamed group renames in every notification about it.
 */
/**
 * Discriminated on `type`, mirroring the CHECK constraint on the table: each kind carries the
 * subjects it is actually about and nothing else. Inferred from the response schema rather
 * than written twice — the schema is the definition, and a second hand-written copy is a
 * second thing to keep in step.
 */
export type Notification = z.infer<typeof NOTIFICATION_RESPONSE>;

/**
 * The database guarantees these are present for the types that need them, but a row is only
 * ever read back as nullable columns. Throwing names the broken invariant rather than letting
 * `undefined` reach a sentence.
 */
function required<Value>(value: Value | null, column: string): Value {
  if (value === null) {
    throw new Error(
      `notification.${column} is null on a row whose type requires it`,
    );
  }
  return value;
}

/**
 * One flat shape, as the query returns it, before it is narrowed onto the union. This
 * describes the SQL result rather than the contract, which is why it is written out: the
 * columns are nullable here even where the type they belong to guarantees them.
 */
type NotificationRow = {
  id: string;
  type: NotificationType;
  occurredAt: string;
  readAt: string | null;
  actorUsername: string | null;
  // Nullable now that a notification may belong to a chat instead. Which of the two is
  // present is decided by `type`, and the CHECK constraint on the table enforces it.
  writingGroupId: string | null;
  writingGroupTitle: string | null;
  visibility: WritingGroupVisibility | null;
  role: UserInWritingGroupRole | null;
  writingThreadId: string | null;
  writingThreadTitle: string | null;
  writingPostId: string | null;
  writingPageId: string | null;
  writingPageTitle: string | null;
  chatGroupId: string | null;
  chatGroupTitle: string | null;
};

function toNotification(row: NotificationRow): Notification {
  const base = {
    id: row.id,
    occurredAt: row.occurredAt,
    readAt: row.readAt,
    actorUsername: row.actorUsername,
  };
  // A function, not a value: the columns are nullable because a notification belongs to one
  // kind of group or the other, so building this eagerly would throw on every chat row.
  const writingGroup = () => ({
    writingGroupId: required(row.writingGroupId, "writingGroupId"),
    writingGroupTitle: required(row.writingGroupTitle, "writingGroupTitle"),
  });

  switch (row.type) {
    case "invited_to_writing_group":
    case "invitation_accepted":
      return { ...base, ...writingGroup(), type: row.type };
    case "visibility_changed_in_writing_group":
      return {
        ...base,
        ...writingGroup(),
        type: row.type,
        visibility: required(row.visibility, "visibility"),
      };
    case "role_changed_in_writing_group":
      return {
        ...base,
        ...writingGroup(),
        type: row.type,
        role: required(row.role, "role"),
      };
    case "new_writing_thread":
      return {
        ...base,
        ...writingGroup(),
        type: row.type,
        writingThreadId: required(row.writingThreadId, "writingThreadId"),
        writingThreadTitle: required(
          row.writingThreadTitle,
          "writingThreadTitle",
        ),
      };
    case "new_writing_post":
      return {
        ...base,
        ...writingGroup(),
        type: row.type,
        writingThreadId: required(row.writingThreadId, "writingThreadId"),
        writingThreadTitle: required(
          row.writingThreadTitle,
          "writingThreadTitle",
        ),
        writingPostId: required(row.writingPostId, "writingPostId"),
      };
    case "new_writing_page":
      return {
        ...base,
        ...writingGroup(),
        type: row.type,
        writingPageId: required(row.writingPageId, "writingPageId"),
        writingPageTitle: required(row.writingPageTitle, "writingPageTitle"),
      };
    case "invited_to_chat_group":
      return {
        ...base,
        type: row.type,
        chatGroupId: required(row.chatGroupId, "chatGroupId"),
        chatGroupTitle: required(row.chatGroupTitle, "chatGroupTitle"),
      };
    default:
      // A new notification type reaches here as a compile error, not a missing line.
      return assertUnreachable(row.type);
  }
}

/**
 * The membership join is inner and needs no `where` on access: the composite foreign key
 * makes a notification about a group the recipient does not belong to impossible to store,
 * so there is nothing here to filter out.
 */
function notificationsFor(recipientId: string) {
  return db
    .selectFrom("notification")
    // Left, not inner: a notification belongs to a writing group or to a chat, never both,
    // so an inner join on either would drop the other kind entirely. The composite foreign
    // keys already guarantee that whichever one is set has a membership behind it, which is
    // what makes access need no `where` of its own.
    .leftJoin(
      "userInWritingGroup",
      (join) =>
        join
          .onRef(
            "userInWritingGroup.writingGroupId",
            "=",
            "notification.writingGroupId",
          )
          .onRef("userInWritingGroup.userId", "=", "notification.recipientId"),
    )
    .leftJoin(
      "writingGroup",
      "writingGroup.id",
      "notification.writingGroupId",
    )
    .leftJoin("chatGroup", "chatGroup.id", "notification.chatGroupId")
    // No alias: this is the only join to `user` here, and an alias would add a table
    // key the shared list helper cannot accept.
    .leftJoin("user", "user.id", "notification.actorId")
    .leftJoin(
      "writingThread",
      "writingThread.id",
      "notification.writingThreadId",
    )
    .leftJoin("writingPage", "writingPage.id", "notification.writingPageId")
    .where("notification.recipientId", "=", recipientId)
    .select([
      "notification.id",
      "notification.type",
      "notification.occurredAt",
      "notification.readAt",
      "user.username as actorUsername",
      "notification.writingGroupId",
      "writingGroup.title as writingGroupTitle",
      "writingGroup.visibility",
      "userInWritingGroup.role",
      "notification.writingThreadId",
      "writingThread.title as writingThreadTitle",
      "notification.writingPageId",
      "writingPage.title as writingPageTitle",
      "notification.writingPostId",
      "notification.chatGroupId",
      "chatGroup.title as chatGroupTitle",
    ]);
}

async function listNotifications(
  recipientId: string,
  query: ListQuery & {
    unreadOnly: boolean;
    hiddenActorIds?: ReadonlyArray<string>;
  },
): Promise<ListResults<Notification>> {
  let notifications = notificationsFor(recipientId);

  if (query.unreadOnly) {
    notifications = notifications.where("notification.readAt", "is", null);
  }

  // Filtered on read rather than never written, so unblocking restores what was missed.
  const hiddenActorIds = query.hiddenActorIds ?? [];
  if (hiddenActorIds.length > 0) {
    notifications = notifications.where((eb) =>
      eb.or([
        // A deleted account leaves its notifications with no actor; those stay readable.
        eb("notification.actorId", "is", null),
        eb("notification.actorId", "not in", hiddenActorIds),
      ])
    );
  }

  const page = await listResultsWithCount(notifications, query);

  // The query returns one flat shape; the union is narrowed here, once.
  return { ...page, results: page.results.map(toNotification) };
}

/** Shown beside the entry to the list, so it runs on every page it appears on. */
async function countUnread(recipientId: string): Promise<number> {
  const { count } = await db
    .selectFrom("notification")
    .select((eb) => eb.fn.countAll<number>().as("count"))
    .where("recipientId", "=", recipientId)
    .where("readAt", "is", null)
    .executeTakeFirstOrThrow();

  return Number(count);
}

/**
 * All at once rather than one by one: opening the list is the act of having read them, and
 * making somebody dismiss each line is the kind of chore that turns a notification list into
 * a task list.
 */
async function markAllRead(recipientId: string): Promise<number> {
  const result = await db
    .updateTable("notification")
    .set({ readAt: Temporal.Now.instant().toString() })
    .where("recipientId", "=", recipientId)
    .where("readAt", "is", null)
    .executeTakeFirst();

  return Number(result.numUpdatedRows);
}

/**
 * Written inside the caller's transaction, so an invitation cannot exist without the person
 * being told about it. The failure worth engineering against is the silent one: an invitation
 * nobody ever sees.
 */
async function insertInvitationNotification(
  transaction: Transaction,
  invitation: { recipientId: string; writingGroupId: string; actorId: string },
): Promise<void> {
  await transaction
    .insertInto("notification")
    .values({
      recipientId: invitation.recipientId,
      writingGroupId: invitation.writingGroupId,
      actorId: invitation.actorId,
      type: "invited_to_writing_group",
    })
    .execute();
}

/**
 * A role change is about a state, not an occurrence: one row per membership, always the most
 * recent change. That is also what lets the role be joined from the membership rather than
 * stored — see the partial unique index the upsert targets.
 */
async function insertRoleChangeNotification(
  transaction: Transaction,
  change: { recipientId: string; writingGroupId: string; actorId: string },
): Promise<void> {
  // An administrator may change their own role. Nobody is told about their own doing, and the
  // constraint enforcing that would otherwise fail the whole transaction.
  if (change.recipientId === change.actorId) {
    return;
  }

  await transaction
    .insertInto("notification")
    .values({ ...change, type: "role_changed_in_writing_group" })
    .onConflict((oc) =>
      oc
        .columns(["recipientId", "writingGroupId"])
        .where("type", "=", "role_changed_in_writing_group")
        .doUpdateSet({
          occurredAt: Temporal.Now.instant().toString(),
          // A fresh change is worth seeing again, however the last one was left.
          readAt: null,
          actorId: change.actorId,
        })
    )
    .execute();
}

/**
 * Fans out to everyone who has actually joined, minus whoever did it. Invited members are
 * left out on purpose: telling somebody what is being written in a group they have not
 * accepted yet is noise about something they are not part of.
 */
async function insertGroupActivityNotifications(
  transaction: Transaction,
  /**
   * A union rather than optional fields, so each type carries exactly the subject it needs —
   * the same shape `notification_subject_matches_type` enforces in the database.
   */
  activity:
    | {
      type: "new_writing_thread";
      writingGroupId: string;
      writingThreadId: string;
      actorId: string;
    }
    | {
      type: "new_writing_post";
      writingGroupId: string;
      writingThreadId: string;
      writingPostId: string;
      actorId: string;
    }
    | {
      type: "new_writing_page";
      writingGroupId: string;
      writingPageId: string;
      actorId: string;
    },
): Promise<void> {
  const recipients = await transaction
    .selectFrom("userInWritingGroup")
    .select("userId")
    .where("writingGroupId", "=", activity.writingGroupId)
    .where("status", "=", "joined")
    .where("userId", "!=", activity.actorId)
    .execute();

  if (recipients.length === 0) {
    return;
  }

  await transaction
    .insertInto("notification")
    .values(recipients.map(({ userId }) => ({
      recipientId: userId,
      type: activity.type,
      actorId: activity.actorId,
      writingGroupId: activity.writingGroupId,
      writingThreadId: "writingThreadId" in activity
        ? activity.writingThreadId
        : null,
      writingPostId: "writingPostId" in activity
        ? activity.writingPostId
        : null,
      writingPageId: "writingPageId" in activity
        ? activity.writingPageId
        : null,
    })))
    .execute();
}

/**
 * Told to whoever opened the door, once it is walked through. Nobody else needs it: an
 * administrator who did not invite this person has no loop to close.
 */
async function insertInvitationAcceptedNotification(
  transaction: Transaction,
  acceptance: {
    invitedBy: string | null;
    writingGroupId: string;
    actorId: string;
  },
): Promise<void> {
  // A founder was invited by nobody, and nobody is told about their own doing.
  if (
    acceptance.invitedBy === null || acceptance.invitedBy === acceptance.actorId
  ) {
    return;
  }

  await transaction
    .insertInto("notification")
    .values({
      recipientId: acceptance.invitedBy,
      writingGroupId: acceptance.writingGroupId,
      actorId: acceptance.actorId,
      type: "invitation_accepted",
    })
    .execute();
}

/**
 * Everyone in the group, minus whoever changed it. A group turning public means everything
 * its members have written becomes readable by anyone with an account, which is the one
 * change here that alters who can see somebody's writing.
 *
 * Collapsed like a role change: the state is what the group is now, not the sequence of flips
 * that got it there, which is also why the visibility itself is joined rather than stored.
 */
async function insertVisibilityChangeNotifications(
  transaction: Transaction,
  change: { writingGroupId: string; actorId: string },
): Promise<void> {
  const recipients = await transaction
    .selectFrom("userInWritingGroup")
    .select("userId")
    .where("writingGroupId", "=", change.writingGroupId)
    .where("status", "=", "joined")
    .where("userId", "!=", change.actorId)
    .execute();

  if (recipients.length === 0) {
    return;
  }

  await transaction
    .insertInto("notification")
    .values(recipients.map(({ userId }) => ({
      recipientId: userId,
      writingGroupId: change.writingGroupId,
      actorId: change.actorId,
      type: "visibility_changed_in_writing_group" as const,
    })))
    .onConflict((oc) =>
      oc
        .columns(["recipientId", "writingGroupId"])
        .where("type", "=", "visibility_changed_in_writing_group")
        .doUpdateSet({
          occurredAt: Temporal.Now.instant().toString(),
          readAt: null,
          actorId: change.actorId,
        })
    )
    .execute();
}

/** The one chat notification: messages are counted by the chat list, not announced here. */
async function insertChatInvitationNotifications(
  transaction: Transaction,
  invitation: {
    recipientIds: ReadonlyArray<string>;
    chatGroupId: string;
    actorId: string;
  },
): Promise<void> {
  await transaction
    .insertInto("notification")
    .values(invitation.recipientIds.map((recipientId) => ({
      recipientId,
      chatGroupId: invitation.chatGroupId,
      actorId: invitation.actorId,
      type: "invited_to_chat_group" as const,
    })))
    .execute();
}

export const NotificationService = {
  listNotifications,
  countUnread,
  markAllRead,
  insertInvitationNotification,
  insertChatInvitationNotifications,
  insertRoleChangeNotification,
  insertGroupActivityNotifications,
  insertInvitationAcceptedNotification,
  insertVisibilityChangeNotifications,
};
