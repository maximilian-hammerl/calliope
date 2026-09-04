import type { Selectable } from "kysely";
import { db } from "@/src/database/client.ts";
import type {
  ChatGroup as DatabaseChatGroup,
  UserInChatGroupStatus,
} from "@/src/database/schema.ts";
import type { User } from "@/src/service/user_service.ts";
import { NotificationService } from "@/src/service/notification_service.ts";
import {
  type ListQuery,
  type ListResults,
  listResultsWithCount,
  searchPattern,
} from "@/src/list/list_endpoint_query.ts";
import {
  type FavouriteFilter,
  FAVOURITES_FIRST,
  withFavourite,
} from "@/src/query/favourite.ts";

export type ChatGroup =
  & Pick<
    Selectable<DatabaseChatGroup>,
    "id" | "title" | "createdBy" | "createdAt" | "lastActivityAt"
  >
  & {
    /** This member's own standing: an invitation is visible but not yet a conversation. */
    status: UserInChatGroupStatus;
    /** Null once the founder's account is gone; the chat outlives it. */
    createdByUsername: string | null;
    /** How many messages arrived after this member last read, for their list entry. */
    unreadMessages: number;
    /** The reader's own favourite, visible to nobody else. */
    isFavourite: boolean;
  };

const SELECTED_COLUMNS = [
  "chatGroup.id",
  "chatGroup.title",
  "chatGroup.createdBy",
  "chatGroup.createdAt",
  "chatGroup.lastActivityAt",
] as const;

/**
 * A chat is only ever visible to somebody in it, so the membership join is the access rule —
 * there is no public chat and nothing to widen.
 *
 * Invitations are included: an invited member has to be able to see what they are being asked
 * to join. The route decides what an invitation may do beyond looking at it.
 */
function chatsOf(user: User) {
  return db
    .selectFrom("chatGroup")
    .innerJoin("userInChatGroup", (join) =>
      join
        .onRef("userInChatGroup.chatGroupId", "=", "chatGroup.id")
        .on("userInChatGroup.userId", "=", user.id));
}

/**
 * The list's own projection, which is the expensive one: the unread count is a correlated COUNT
 * over every message of the chat. Kept apart from the rule above so the gate does not pay for it —
 * `checkJoinedChatMember` runs on every message sent and every page of messages read, and it was
 * counting unread messages each time only to throw the number away.
 */
function chatsWithDetail(user: User) {
  return chatsOf(user)
    .leftJoin("user", "user.id", "chatGroup.createdBy")
    .$call((builder) =>
      withFavourite(builder, "chat_group", "chatGroup.id", user.id)
    )
    .select((eb) => [
      ...SELECTED_COLUMNS,
      "userInChatGroup.status",
      "user.username as createdByUsername",
      // Counted against the member's own last_read_at, which is why it cannot be a column on
      // the chat: the same chat is a different number of unread messages per person.
      // Wrapped in coalesce so the type is not nullable: a correlated subquery is optional to
      // Kysely even where COUNT always returns a row.
      eb.fn.coalesce(
        eb
          .selectFrom("chatMessage")
          .whereRef("chatMessage.chatGroupId", "=", "chatGroup.id")
          .where((inner) =>
            inner.or([
              inner("userInChatGroup.lastReadAt", "is", null),
              inner.eb(
                "chatMessage.createdAt",
                ">",
                inner.ref("userInChatGroup.lastReadAt"),
              ),
            ])
          )
          // Your own messages are not news to you.
          .where((inner) =>
            inner.or([
              inner("chatMessage.createdBy", "is", null),
              inner("chatMessage.createdBy", "!=", user.id),
            ])
          )
          .select((inner) => inner.fn.countAll<number>().as("count")),
        eb.lit(0),
      ).as("unreadMessages"),
    ]);
}

function listChatGroups(
  user: User,
  query: ListQuery & { favourite: FavouriteFilter },
): Promise<ListResults<ChatGroup>> {
  return listResultsWithCount(
    chatsWithDetail(user)
      // `$if` rather than reassigning the builder through an `if`, which is what the rest of this
      // codebase does and what the conditional-selects recipe asks for.
      .$if(query.search !== undefined, (queryBuilder) =>
        queryBuilder.where(
          "chatGroup.title",
          "ilike",
          // deno-lint-ignore no-non-null-assertion -- the `$if` only runs this when it is set
          searchPattern(query.search!),
        ))
      .$if(
        query.favourite === "only",
        (queryBuilder) => queryBuilder.where("favourite.id", "is not", null),
      ),
    query,
    FAVOURITES_FIRST,
  );
}

/**
 * Whether the member is in the chat at all, and what it is called. Not the list's projection: all
 * four callers use this as a gate and only one reads anything off it — `title` for the excerpt of
 * a reported chat, `createdBy` for who answers for it.
 */
export type ChatGroupGate = {
  id: string;
  title: string;
  createdBy: string | null;
  status: UserInChatGroupStatus;
};

/** Returns nothing when the chat does not exist or the user is not in it. */
async function selectChatGroup(
  user: User,
  chatGroupId: string,
): Promise<ChatGroupGate | undefined> {
  return await chatsOf(user)
    .select([
      "chatGroup.id",
      "chatGroup.title",
      "chatGroup.createdBy",
      "userInChatGroup.status",
    ])
    .where("chatGroup.id", "=", chatGroupId)
    .executeTakeFirst();
}

/**
 * The founder joins outright; everybody else is invited and has to accept. Invitations ride
 * the same transaction as the chat, so a conversation cannot exist half-announced.
 */
async function insertChatGroup(
  creator: User,
  title: string,
  inviteeIds: ReadonlyArray<string> = [],
): Promise<ChatGroup> {
  const id = await db.transaction().execute(async (transaction) => {
    const chatGroup = await transaction
      .insertInto("chatGroup")
      .values({ title, createdBy: creator.id })
      .returning(["id"])
      .executeTakeFirstOrThrow();

    await transaction
      .insertInto("userInChatGroup")
      .values({
        userId: creator.id,
        chatGroupId: chatGroup.id,
        // Nobody invites you to the chat you just made.
        status: "joined",
      })
      .execute();

    if (inviteeIds.length > 0) {
      await transaction
        .insertInto("userInChatGroup")
        .values(inviteeIds.map((userId) => ({
          userId,
          chatGroupId: chatGroup.id,
          status: "invited" as const,
        })))
        .execute();

      await NotificationService.insertChatInvitationNotifications(transaction, {
        recipientIds: inviteeIds,
        chatGroupId: chatGroup.id,
        actorId: creator.id,
      });
    }

    return chatGroup.id;
  });

  // Re-read rather than RETURNING: the unread count, the founder's name and the favourite are all
  // joined, and a newly created chat is answered in the same shape the list uses.
  return await chatsWithDetail(creator)
    .where("chatGroup.id", "=", id)
    .executeTakeFirstOrThrow();
}

/** Everyone still in the chat, so a message knows who to reach. */
async function selectMemberIds(chatGroupId: string): Promise<Array<string>> {
  const members = await db
    .selectFrom("userInChatGroup")
    .select("userId")
    .where("chatGroupId", "=", chatGroupId)
    .where("status", "=", "joined")
    .execute();

  return members.map(({ userId }) => userId);
}

/**
 * Everything up to now counts as read. Stamped from the application clock like the rest of
 * the writes here, so no raw SQL is needed for it.
 */
async function markRead(chatGroupId: string, userId: string): Promise<void> {
  await db
    .updateTable("userInChatGroup")
    .set({ lastReadAt: Temporal.Now.instant().toString() })
    .where("chatGroupId", "=", chatGroupId)
    .where("userId", "=", userId)
    .execute();
}

export const ChatGroupService = {
  listChatGroups,
  selectChatGroup,
  insertChatGroup,
  selectMemberIds,
  markRead,
};
