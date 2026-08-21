/**
 * Fixed development data, so nobody builds eight groups and nine members by hand.
 *
 *     deno task db:seed
 *
 * The fixtures themselves are in `seed/`; this file is the guard, the cleanup and the order.
 */
import { db } from "@/src/database/client.ts";
import { getRequiredEnvVariable } from "@/src/util/env.ts";
import { USER } from "@/seed/accounts.ts";
import { GROUPS } from "@/seed/writing_groups.ts";
import { CHATS } from "@/seed/chats.ts";
import { writeFixtures } from "@/seed/write.ts";

/** The one password every seeded account shares. Local only — see the guard below. */
const PASSWORD = "calliope";

function assertLocalDatabase(): void {
  const url = new URL(getRequiredEnvVariable("DATABASE_URL"));
  // Not "db": that is the compose service name in production as much as in development, so
  // accepting it would let the containerised seed wipe production without --force.
  const local = ["localhost", "127.0.0.1", "::1", "postgres"];

  if (!local.includes(url.hostname) && !Deno.args.includes("--force")) {
    console.error(
      `Refusing to seed ${url.hostname}: it does not look local. Pass --force to override.`,
    );
    Deno.exit(1);
  }
}

// Only its own rows, so half-built state survives a re-seed. Users cascade; the groups and
// chats need removing explicitly because their creator is not their only member.
async function removePreviousSeed(): Promise<void> {
  await db.deleteFrom("writingGroup")
    .where("id", "in", GROUPS.map((group) => group.id))
    .execute();
  await db.deleteFrom("chatGroup")
    .where("id", "in", CHATS.map((chat) => chat.id))
    .execute();
  // By name as well as by id: on id alone, an account somebody made by hand under a seeded
  // name would block every re-run.
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

/** Compact on purpose: nine accounts described in prose was longer than anybody reads. */
function summary(): string {
  const accounts = (Object.keys(USER) as Array<keyof typeof USER>)
    .filter((name) => name !== "unverified")
    .map((name) => {
      const groups = GROUPS.filter((group) =>
        group.members.some((member) => member.user === USER[name])
      );
      const founded = groups.filter((group) => group.by === USER[name]).length;
      const roles = new Set(
        groups.flatMap((group) =>
          group.members
            .filter((member) => member.user === USER[name])
            .map((member) =>
              `${member.status === "invited" ? "invited " : ""}${member.role}`
            )
        ),
      );
      const where = groups.length === 0
        ? "no groups"
        : `${groups.length} group(s), ${[...roles].join(" / ")}`;
      return `  ${name.padEnd(15)}${
        founded > 0 ? `founded ${founded}, ` : ""
      }${where}`;
    })
    .join("\n");

  const entries = [
    GROUPS.find((group) =>
      group.visibility === "public" && group.members.length > 3
    ),
    GROUPS.find((group) =>
      group.visibility === "private" && group.threads !== undefined
    ),
    GROUPS.find((group) => group.threads === undefined),
  ];

  const urls = entries
    .filter((group) => group !== undefined)
    .map((group) => `  /groups/${group.id}   ${group.title}`)
    .join("\n");

  return `Seeded. Every account's password is "${PASSWORD}".

${accounts}
  unverified     address not confirmed, so only the verification wall is reachable

${urls}`;
}

export async function seedDatabase() {
  assertLocalDatabase();
  await removePreviousSeed();
  await writeFixtures();

  console.log(summary());

  Deno.exit(0);
}

if (import.meta.main) {
  await seedDatabase();
}
