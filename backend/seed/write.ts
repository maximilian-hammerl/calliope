import { db } from "@/src/database/client.ts";
import { hashPassword } from "@/src/util/password.ts";
import { PLATFORM_ROLES, USER, VERIFIED_USERNAMES } from "@/seed/accounts.ts";
import { GROUPS } from "@/seed/writing_groups.ts";
import { STORY_IDEAS } from "@/seed/story_ideas.ts";
import { CHATS } from "@/seed/chats.ts";
import { BLOCKS } from "@/seed/blocks.ts";
import { REPORTS } from "@/seed/reports.ts";
import { FAVOURITES } from "@/seed/favourites.ts";
import { notificationId } from "@/seed/ids.ts";
import { FAVOURITE_COLUMN } from "@/src/service/favourite_target.ts";
import type { FavouriteTargetType } from "@/src/service/favourite_target.ts";
import { plainTextToDocument } from "@/src/document/document_text.ts";

/**
 * The ids are written by hand, so two of them can be the same by accident — a notification
 * once shared an id with a user because `padStart` reads "0a1" and "a1" alike. Checking beats
 * remembering.
 */
function assertDistinctIds(): void {
  const ids = [
    ...Object.values(USER),
    ...GROUPS.flatMap((group) => [
      group.id,
      ...(group.threads ?? []).flatMap((thread) => [
        thread.id,
        ...thread.posts.map((post) => post.id),
      ]),
      ...(group.steps ?? []).map((step) => step.id),
    ]),
    ...STORY_IDEAS.map((idea) => idea.id),
    ...CHATS.flatMap((chat) => [chat.id, ...chat.messages.map((m) => m.id)]),
    ...REPORTS.map((report) => report.id),
    ...FAVOURITES.map((favourite) => favourite.id),
  ];

  const seen = new Set(ids);
  if (seen.size !== ids.length) {
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    throw new Error(
      `Seed ids are not unique: ${[...new Set(duplicates)].join(", ")}`,
    );
  }
}

/** A founder who is not a joined administrator of their own group would be a fixture nobody meant. */
function assertFoundersAdminister(): void {
  for (const group of GROUPS) {
    const founder = group.members.find((member) => member.user === group.by);
    if (founder?.role !== "administrator" || founder.status === "invited") {
      throw new Error(
        `${group.title}: the founder is not a joined administrator`,
      );
    }
  }
  for (const chat of CHATS) {
    const creator = chat.members.find((member) => member.user === chat.by);
    if (creator === undefined || creator.status === "invited") {
      throw new Error(`${chat.title}: the creator has not joined`);
    }
  }
}

/**
 * A favourite naming an id no fixture holds fails as a foreign key violation, which reports the
 * constraint and the uuid and not which entry is wrong. `postId(305)` is one past the end of the
 * long thread and looks perfectly reasonable in the source.
 */
function assertFavouritesNameSomething(): void {
  const known = {
    writing_group: new Set(GROUPS.map((group) => group.id)),
    writing_thread: new Set(
      GROUPS.flatMap((group) => (group.threads ?? []).map((t) => t.id)),
    ),
    writing_post: new Set(
      GROUPS.flatMap((group) =>
        (group.threads ?? []).flatMap((t) => t.posts.map((post) => post.id))
      ),
    ),
    story_idea: new Set(STORY_IDEAS.map((idea) => idea.id)),
    chat_group: new Set(CHATS.map((chat) => chat.id)),
  } as const satisfies Record<FavouriteTargetType, ReadonlySet<string>>;

  for (const favourite of FAVOURITES) {
    if (!known[favourite.targetType].has(favourite.targetId)) {
      throw new Error(
        `${favourite.user} favourites a ${favourite.targetType} that the fixture does not hold: ${favourite.targetId}`,
      );
    }
  }
}

/**
 * A block withdraws any invitation still open between the two, so a fixture holding both at
 * once shows a state the application cannot produce.
 */
function assertBlocksHaveNoPendingInvitation(): void {
  const pending = [
    ...GROUPS.flatMap((group) =>
      group.members
        .filter((member) => member.status === "invited")
        .map((member) => ({ from: group.by, to: member.user }))
    ),
    ...CHATS.flatMap((chat) =>
      chat.members
        .filter((member) => member.status === "invited")
        .map((member) => ({ from: chat.by, to: member.user }))
    ),
  ];

  for (const { blocker, blocked } of BLOCKS) {
    const conflict = pending.find(({ from, to }) =>
      (from === blocker && to === blocked) ||
      (from === blocked && to === blocker)
    );
    if (conflict !== undefined) {
      throw new Error(
        "A blocked pair also has a pending invitation between them",
      );
    }
  }
}

/** `stepsBack` five-minute steps before now, so fixture order and chronology agree. */
function postedAt(stepsBack: number): string {
  return Temporal.Now.instant().subtract({ minutes: stepsBack * 5 }).toString();
}

/**
 * Steps between one thread's newest post and the next thread's, so no two posts in the fixture
 * share a moment and every thread reads as written over hours rather than at once.
 *
 * It does **not** spread `last_activity_at`. That column belongs to the database: a BEFORE
 * UPDATE trigger sets it to `now()` on any change, and the post insert cascades into it, so
 * every thread and group written in one run carries the seeding moment whatever the fixture
 * says. Ordering by it therefore shows nothing here — which is honest, since nothing has
 * happened in these groups since they were seeded a second ago.
 */
const STEPS_BETWEEN_THREADS = 24;

/**
 * The newest post of the `index`th of `total` threads, which is also that thread's last
 * activity. Counted from the end so later in the fixture means more recent: chapters are
 * written in order, and a fixture whose Chapter One is the freshest thing reads as a mistake.
 */
function newestPostOfThread(index: number, total: number): number {
  return (total - index) * STEPS_BETWEEN_THREADS + 1;
}

async function writeAccounts(): Promise<void> {
  // Hashed once and shared: scrypt is deliberately slow, and these are local accounts.
  const hashedPassword = await hashPassword("calliope");

  await db.insertInto("user").values(
    VERIFIED_USERNAMES.map((name) => ({
      id: USER[name],
      username: name,
      emailAddress: `${name}@example.test`,
      hashedPassword,
      // Verified, because every gated route refuses an unverified member and the fixture is
      // meant for working on everything else.
      emailAddressVerifiedAt: Temporal.Now.instant().toString(),
      platformRole: PLATFORM_ROLES[name as keyof typeof PLATFORM_ROLES] ?? null,
    })),
  ).execute();

  // Reaches the verification wall and nothing else, so that screen can be worked on without
  // registering by hand and digging the link out of Mailpit each time.
  await db.insertInto("user").values({
    id: USER.unverified,
    username: "unverified",
    emailAddress: "unverified@example.test",
    hashedPassword,
  }).execute();
}

async function writeBlocks(): Promise<void> {
  await db.insertInto("userBlock").values(BLOCKS.map((block) => ({
    blockerId: block.blocker,
    blockedId: block.blocked,
  }))).execute();
}

async function writeGroups(): Promise<void> {
  await db.insertInto("writingGroup").values(GROUPS.map((group) => ({
    id: group.id,
    title: group.title,
    subtitle: group.subtitle,
    synopsis: group.synopsis,
    visibility: group.visibility,
    language: group.language,
    storyStatus: group.storyStatus,
    genres: group.genres,
    subgenres: group.subgenres,
    tropes: group.tropes,
    contentWarnings: group.contentWarnings,
    tense: group.tense,
    perspective: group.perspective,
    createdBy: group.by,
  }))).execute();

  await db.insertInto("userInWritingGroup").values(
    GROUPS.flatMap((group) =>
      group.members.map((member) => ({
        writingGroupId: group.id,
        userId: member.user,
        role: member.role,
        status: member.status ?? "joined",
        // The real invite path records who invited; a fixture that leaves it null shows an
        // invitation nobody sent.
        invitedBy: member.status === "invited" ? group.by : null,
      }))
    ),
  ).execute();

  const threads = GROUPS.flatMap((group) =>
    (group.threads ?? []).map((thread) => ({ group, thread }))
  );

  await db.insertInto("writingThread").values(
    threads.map(({ group, thread }) => ({
      id: thread.id,
      writingGroupId: group.id,
      title: thread.title,
      createdBy: thread.by,
    })),
  ).execute();

  await db.insertInto("writingPost").values(
    threads.flatMap(({ thread }, threadIndex) =>
      thread.posts.map((post, index) => ({
        id: post.id,
        writingThreadId: thread.id,
        document: plainTextToDocument(post.text),
        text: post.text,
        isDraft: post.isDraft ?? false,
        createdBy: post.by,
        // Stamped from the position in the fixture rather than left to the column default:
        // one insert statement shares a single `now()`, so every post would carry the same
        // timestamp. Sorting by a column full of ties has no defined order, which is exactly
        // what paging cannot survive — page two would repeat rows from page one. The thread's
        // own offset is what keeps two threads from ending at the same moment.
        createdAt: postedAt(
          newestPostOfThread(threadIndex, threads.length) +
            (thread.posts.length - 1 - index),
        ),
      }))
    ),
  ).execute();

  await db.insertInto("writingGroupNextStep").values(
    GROUPS.flatMap((group) =>
      (group.steps ?? []).map((step) => ({
        id: step.id,
        writingGroupId: group.id,
        text: step.text,
        createdBy: step.by,
        completedAt: step.completedBy === undefined
          ? null
          : Temporal.Now.instant().toString(),
        completedBy: step.completedBy ?? null,
      }))
    ),
  ).execute();
}

async function writeChats(): Promise<void> {
  await db.insertInto("chatGroup").values(CHATS.map((chat) => ({
    id: chat.id,
    title: chat.title,
    createdBy: chat.by,
  }))).execute();

  await db.insertInto("userInChatGroup").values(
    CHATS.flatMap((chat) =>
      chat.members.map((member) => ({
        chatGroupId: chat.id,
        userId: member.user,
        status: member.status ?? "joined",
      }))
    ),
  ).execute();

  await db.insertInto("chatMessage").values(
    CHATS.flatMap((chat, chatIndex) =>
      chat.messages.map((message, index) => ({
        id: message.id,
        chatGroupId: chat.id,
        text: message.text,
        createdBy: message.by,
        // Same reason as a thread's posts: the chat list is ordered by last activity, and one
        // insert statement would give every chat the same one.
        createdAt: postedAt(
          newestPostOfThread(chatIndex, CHATS.length) +
            (chat.messages.length - 1 - index),
        ),
      }))
    ),
  ).execute();
}

/**
 * Ideas five hours apart, stamped from fixture position: one insert statement shares a single
 * `now()`, and the board cannot page over a column of ties. Ascending with the ids, so ordering
 * by either agrees — which the carousel relies on, since it walks by id.
 */
const STEPS_BETWEEN_IDEAS = 60;

async function writeStoryIdeas(): Promise<void> {
  await db.insertInto("storyIdea").values(STORY_IDEAS.map((idea, index) => ({
    id: idea.id,
    title: idea.title,
    subtitle: idea.subtitle,
    teaser: idea.teaser,
    synopsis: idea.synopsis,
    status: idea.status,
    language: idea.language,
    genres: idea.genres,
    subgenres: idea.subgenres,
    tropes: idea.tropes,
    contentWarnings: idea.contentWarnings,
    tense: idea.tense,
    perspective: idea.perspective,
    lookingFor: idea.lookingFor,
    partySize: idea.partySize,
    createdBy: idea.by,
    createdAt: postedAt((STORY_IDEAS.length - index) * STEPS_BETWEEN_IDEAS),
  }))).execute();
}

/**
 * Derived rather than listed: every pending invitation is one the services would have
 * announced, and with eight groups a hand-written list is where the fixture goes stale.
 * This restates service behaviour, so it changes when that rule does.
 */
async function writeNotifications(): Promise<void> {
  const invitations = [
    ...GROUPS.flatMap((group) =>
      group.members
        .filter((member) => member.status === "invited")
        .map((member) => ({
          recipientId: member.user,
          type: "invited_to_writing_group" as const,
          actorId: group.by,
          writingGroupId: group.id,
        }))
    ),
    ...CHATS.flatMap((chat) =>
      chat.members
        .filter((member) => member.status === "invited")
        .map((member) => ({
          recipientId: member.user,
          type: "invited_to_chat_group" as const,
          actorId: chat.by,
          chatGroupId: chat.id,
        }))
    ),
  ];

  await db.insertInto("notification").values(
    invitations.map((invitation, index) => ({
      id: notificationId(index + 1),
      ...invitation,
    })),
  ).execute();
}

/** In dependency order, which is the reason this lives in one place. */
/** The column a report's target id goes in, which `report_target_matches_type` also enforces. */
const REPORT_TARGET_COLUMN = {
  writing_group: "reportedWritingGroupId",
  writing_thread: "reportedWritingThreadId",
  writing_post: "reportedWritingPostId",
  story_idea: "reportedStoryIdeaId",
  chat_group: "reportedChatGroupId",
  chat_message: "reportedChatMessageId",
  user: "reportedUserId",
} as const;

/** Three hours apart and oldest first, so the queue's oldest-first sort has something to sort. */
const HOURS_BETWEEN_REPORTS = 3;

function reportedAt(index: number, total: number): Temporal.Instant {
  return Temporal.Now.instant().subtract({
    hours: (total - index) * HOURS_BETWEEN_REPORTS,
  });
}

/**
 * One insert, because the lifecycle is columns on the report rather than rows beside it. The
 * timestamps are what a state *is* here: `status` is generated from them, so a fixture cannot
 * state a status its own timestamps contradict.
 */
async function writeReports(): Promise<void> {
  await db.insertInto("report").values(
    REPORTS.map((report, index) => {
      const at = reportedAt(index, REPORTS.length);
      const progress = report.progress;
      const closing = progress !== undefined && "outcome" in progress
        ? progress
        : undefined;

      return {
        id: report.id,
        reporterId: report.reporter,
        targetType: report.targetType,
        // Null for a deleted target, which is the state SET NULL leaves behind and the one the
        // queue's "Gelöscht" badge is for.
        ...(report.targetId === null
          ? {}
          : { [REPORT_TARGET_COLUMN[report.targetType]]: report.targetId }),
        reportedAuthorId: report.author,
        targetExcerpt: report.excerpt,
        category: report.category,
        reason: report.reason,
        createdAt: at.toString(),
        operatorId: progress?.operator ?? null,
        // Twenty minutes after it was filed, and the closing twenty after that, so both sit inside
        // the three hours before the next report and read in the order they happened.
        inProgressAt: progress?.taken === true
          ? at.add({ minutes: 20 }).toString()
          : null,
        closedAt: closing === undefined
          ? null
          : at.add({ minutes: 40 }).toString(),
        closingOutcome: closing?.outcome ?? null,
        closingNote: closing?.note ?? null,
      };
    }),
  ).execute();
}

/**
 * One row per favourite, with the kind written into the column it belongs in rather than beside
 * it: `favourite` has no `target_type`, so `FAVOURITE_COLUMN` is shared with the services rather
 * than restated here — a second copy is what would drift.
 *
 * Nothing cleans these up. Every reference cascades, including the member's, so deleting the
 * seeded accounts takes the favourites with them; `report` needs its own delete only because its
 * references are SET NULL.
 */
async function writeFavourites(): Promise<void> {
  await db.insertInto("favourite").values(
    FAVOURITES.map((favourite) => ({
      id: favourite.id,
      userId: favourite.user,
      ...{ [FAVOURITE_COLUMN[favourite.targetType]]: favourite.targetId },
    })),
  ).execute();
}

export async function writeFixtures(): Promise<void> {
  assertDistinctIds();
  assertFoundersAdminister();
  assertBlocksHaveNoPendingInvitation();
  assertFavouritesNameSomething();

  await writeAccounts();
  await writeBlocks();
  await writeGroups();
  await writeChats();
  await writeStoryIdeas();
  await writeNotifications();
  await writeFavourites();
  // Last, because a report points at a post, an idea or an account that has to exist first.
  await writeReports();
}
