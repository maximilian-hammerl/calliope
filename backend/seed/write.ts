import { db } from "@/src/database/client.ts";
import { hashPassword } from "@/src/util/password.ts";
import { USER, VERIFIED_USERNAMES } from "@/seed/accounts.ts";
import { GROUPS } from "@/seed/writing_groups.ts";
import { STORY_IDEAS } from "@/seed/story_ideas.ts";
import { CHATS } from "@/seed/chats.ts";
import { BLOCKS } from "@/seed/blocks.ts";
import { notificationId } from "@/seed/ids.ts";

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
    blurb: group.blurb,
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
    threads.flatMap(({ thread }) =>
      thread.posts.map((post) => ({
        id: post.id,
        writingThreadId: thread.id,
        text: post.text,
        isDraft: post.isDraft ?? false,
        createdBy: post.by,
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
    CHATS.flatMap((chat) =>
      chat.messages.map((message) => ({
        id: message.id,
        chatGroupId: chat.id,
        text: message.text,
        createdBy: message.by,
      }))
    ),
  ).execute();
}

async function writeStoryIdeas(): Promise<void> {
  await db.insertInto("storyIdea").values(STORY_IDEAS.map((idea) => ({
    id: idea.id,
    title: idea.title,
    subtitle: idea.subtitle,
    idea: idea.idea,
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
export async function writeFixtures(): Promise<void> {
  assertDistinctIds();
  assertFoundersAdminister();
  assertBlocksHaveNoPendingInvitation();

  await writeAccounts();
  await writeBlocks();
  await writeGroups();
  await writeChats();
  await writeStoryIdeas();
  await writeNotifications();
}
