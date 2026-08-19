/**
 * Fixed development data, so nobody has to build a group, a thread and four members by hand
 * every time they want to look at something.
 *
 * Rows carry hard-coded ids, which is the point: a URL you bookmarked keeps working after a
 * re-seed. Passwords go through the real `hashPassword`, because scrypt lives in the
 * application and pgcrypto was deliberately removed — a hard-coded hash would rot silently
 * the day its parameters changed, and the seeded accounts would stop being able to sign in
 * with nothing to say why.
 *
 * Inserted through Kysely rather than the services: the services generate their own ids, and
 * fixed ids are worth more here than reusing them. Everything the *database* does still
 * happens — `invited_at`, `joined_at` and `last_activity_at` are triggers, so they fire
 * either way. What is restated rather than invoked is service-level behaviour: the
 * notification an invitation produces is written out below, so if that rule changes this file
 * has to change with it. Kysely keeps it honest about the schema — a renamed column fails
 * `deno check` rather than at run time.
 *
 *     deno task seed
 */
import { db } from "@/src/database/client.ts";
import { hashPassword } from "@/src/util/password.ts";
import { getRequiredEnvVariable } from "@/src/util/env.ts";

/** The one password every seeded account shares. Local only — see the guard below. */
const PASSWORD = "calliope";

/**
 * Obviously synthetic, so a seeded row is recognisable in a query, and stable, so links to
 * one keep working. The shape is a valid uuidv7; only the default generates a real timestamp.
 */
const id = (suffix: string) =>
  `01a00000-0000-7000-8000-${suffix.padStart(12, "0")}`;

const USER = {
  mira: id("a1"),
  annelie: id("a2"),
  tomas: id("a3"),
  bernadette: id("a4"),
  unverified: id("a5"),
} as const;

const GROUP = { market: id("b1"), workshop: id("b2") } as const;
const THREAD = { plot: id("c1"), profiles: id("c2") } as const;
const POST = {
  first: id("d1"),
  second: id("d2"),
  third: id("d3"),
  draft: id("d4"),
} as const;
const CHAT = { pair: id("e1") } as const;
const MESSAGE = { one: id("f1"), two: id("f2"), three: id("f3") } as const;
const NOTIFICATION = {
  invitation: id("0a1"),
  chatInvitation: id("0a2"),
} as const;

/**
 * This deletes rows. A seed pointed at the deployed database would be a bad afternoon, so it
 * refuses anything that is not obviously local unless it is told twice.
 */
function assertLocalDatabase(): void {
  const url = new URL(getRequiredEnvVariable("DATABASE_URL"));
  const isLocal = ["localhost", "127.0.0.1", "::1", "db"].includes(
    url.hostname,
  );

  if (!isLocal && !Deno.args.includes("--force")) {
    console.error(
      `Refusing to seed ${url.hostname}: this deletes rows, and only localhost is assumed ` +
        `safe. Pass --force if you are certain.`,
    );
    Deno.exit(1);
  }
}

/**
 * Only what this file created, found by its own ids, so a half-built group somebody is in the
 * middle of testing survives a re-seed. Users cascade to everything they own, which covers
 * most of it; the two groups are removed explicitly because their creator is not their only
 * member.
 */
async function removePreviousSeed(): Promise<void> {
  await db.deleteFrom("writingGroup").where("id", "in", Object.values(GROUP))
    .execute();
  await db.deleteFrom("chatGroup").where("id", "in", Object.values(CHAT))
    .execute();
  // By name as well as by id: the seed owns these four usernames. Matching only on id would
  // leave an account somebody made by hand as `mira` in the way, and no re-run could clear it
  // — the same trap if the ids here are ever renumbered.
  await db
    .deleteFrom("user")
    .where((eb) =>
      eb.or([
        eb("id", "in", Object.values(USER)),
        eb("username", "in", Object.keys(USER)),
      ])
    )
    .execute();
}

async function seed(): Promise<void> {
  const hashedPassword = await hashPassword(PASSWORD);

  // Verified, because every gated route refuses an unverified member and the fixture is
  // meant for working on everything else. `unverified` below is the one exception.
  await db.insertInto("user").values(
    (["mira", "annelie", "tomas", "bernadette"] as const).map((name) => ({
      id: USER[name],
      username: name,
      emailAddress: `${name}@example.test`,
      hashedPassword,
      emailVerifiedAt: Temporal.Now.instant().toString(),
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

  await db.insertInto("writingGroup").values([
    {
      id: GROUP.market,
      title: "Der Erinnerungsmarkt",
      description:
        "Ein Markt, der nur nach Einbruch der Dunkelheit öffnet. Wer dort kauft, zahlt mit Erinnerungen.",
      visibility: "private",
      createdBy: USER.mira,
    },
    {
      id: GROUP.workshop,
      title: "Offene Werkstatt",
      description:
        "Eine öffentliche Gruppe zum Ausprobieren. Alle dürfen mitlesen.",
      visibility: "public",
      createdBy: USER.mira,
    },
  ]).execute();

  // Every membership state at once, so each of them is visible somewhere without setting it up.
  await db.insertInto("userInWritingGroup").values([
    {
      writingGroupId: GROUP.market,
      userId: USER.mira,
      role: "administrator",
      status: "joined",
    },
    {
      writingGroupId: GROUP.market,
      userId: USER.annelie,
      role: "writer",
      status: "joined",
    },
    {
      writingGroupId: GROUP.market,
      userId: USER.tomas,
      role: "reader",
      status: "joined",
    },
    {
      writingGroupId: GROUP.market,
      userId: USER.bernadette,
      role: "writer",
      status: "invited",
    },
    {
      writingGroupId: GROUP.workshop,
      userId: USER.mira,
      role: "administrator",
      status: "joined",
    },
  ]).execute();

  await db.insertInto("writingThread").values([
    {
      id: THREAD.plot,
      writingGroupId: GROUP.market,
      title: "Plot",
      createdBy: USER.mira,
    },
    {
      id: THREAD.profiles,
      writingGroupId: GROUP.market,
      title: "Steckbriefe",
      createdBy: USER.annelie,
    },
  ]).execute();

  await db.insertInto("writingPost").values([
    {
      id: POST.first,
      writingThreadId: THREAD.plot,
      text: "Die Laternen gingen aus, und der Markt öffnete.",
      isDraft: false,
      createdBy: USER.mira,
    },
    {
      id: POST.second,
      writingThreadId: THREAD.plot,
      text:
        "Sie hatte sich vorgenommen, nichts zu kaufen. Das nahmen sich alle vor, sagte der Händler.",
      isDraft: false,
      createdBy: USER.annelie,
    },
    {
      id: POST.third,
      writingThreadId: THREAD.profiles,
      text: "Die Händlerin: keine Erinnerung an ihr eigenes Gesicht.",
      isDraft: false,
      createdBy: USER.annelie,
    },
    // Unpublished, so the composer has something to restore and the draft rules are visible.
    {
      id: POST.draft,
      writingThreadId: THREAD.plot,
      text: "Noch nicht fertig — was, wenn der Markt sie schon kennt?",
      isDraft: true,
      createdBy: USER.mira,
    },
  ]).execute();

  await db.insertInto("chatGroup").values({
    id: CHAT.pair,
    title: "Zum Erinnerungsmarkt",
    createdBy: USER.mira,
  }).execute();

  await db.insertInto("userInChatGroup").values([
    { chatGroupId: CHAT.pair, userId: USER.mira, status: "joined" },
    { chatGroupId: CHAT.pair, userId: USER.annelie, status: "joined" },
    // Invited and not yet accepted, so that state is reachable too.
    { chatGroupId: CHAT.pair, userId: USER.tomas, status: "invited" },
  ]).execute();

  await db.insertInto("chatMessage").values([
    {
      id: MESSAGE.one,
      chatGroupId: CHAT.pair,
      text: "Hast du den zweiten Absatz gelesen?",
      createdBy: USER.mira,
    },
    {
      id: MESSAGE.two,
      chatGroupId: CHAT.pair,
      text: "Ja. Der Händler darf ruhig unangenehmer sein.",
      createdBy: USER.annelie,
    },
    {
      id: MESSAGE.three,
      chatGroupId: CHAT.pair,
      text: "Einverstanden. Ich schreibe heute Abend weiter.",
      createdBy: USER.mira,
    },
  ]).execute();

  // What the services would have written when these invitations were sent.
  await db.insertInto("notification").values([
    {
      id: NOTIFICATION.invitation,
      recipientId: USER.bernadette,
      type: "invited_to_writing_group",
      actorId: USER.mira,
      writingGroupId: GROUP.market,
    },
    {
      id: NOTIFICATION.chatInvitation,
      recipientId: USER.tomas,
      type: "invited_to_chat_group",
      actorId: USER.mira,
      chatGroupId: CHAT.pair,
    },
  ]).execute();
}

assertLocalDatabase();
await removePreviousSeed();
await seed();

console.log(`Seeded. Every account's password is "${PASSWORD}".

  mira         administrator of both groups, has an unpublished draft
  annelie      writer in Der Erinnerungsmarkt, in the chat
  tomas        reader in Der Erinnerungsmarkt, invited to the chat
  bernadette   invited to Der Erinnerungsmarkt, has not accepted
  unverified   address not confirmed, so only the verification wall is reachable

  /groups/${GROUP.market}
  /groups/${GROUP.market}/threads/${THREAD.plot}
  /groups/${GROUP.workshop}`);

await db.destroy();
