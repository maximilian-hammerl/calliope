/**
 * Grants and revokes the platform roles, from the command line:
 *
 *     deno task grant-role nachtschreiber administrator
 *     docker compose -f docker-compose.deploy.yaml run --rm --no-deps backend \
 *       --grant-role nachtschreiber administrator
 *
 * The first operator has to come from somewhere, and the alternatives were worse: a migration
 * would write a person into the schema of a repository other communities are meant to run, and
 * an environment variable would make granting power a silent side effect of editing a file.
 * This way it is an act, it is logged where the operator ran it, and it needs the server.
 */
import { db } from "@/src/database/client.ts";
import { PLATFORM_ROLES } from "@/src/database/schema.ts";
import type { PlatformRole } from "@/src/database/schema.ts";

function fail(message: string): never {
  console.error(message);
  Deno.exit(1);
}

/** The value after the flag, so the flag reads as a command with arguments. */
function argumentAfter(flag: string): string | undefined {
  const index = Deno.args.indexOf(flag);
  const value = index === -1 ? undefined : Deno.args[index + 1];
  return value?.startsWith("--") ? undefined : value;
}

async function setRole(
  username: string,
  role: PlatformRole | null,
): Promise<void> {
  const updated = await db
    .updateTable("user")
    .set({ platformRole: role })
    .where("username", "=", username)
    .returning(["username", "platformRole"])
    .executeTakeFirst();

  if (updated === undefined) {
    fail(`No account named "${username}".`);
  }

  console.log(
    role === null
      ? `${updated.username} is no longer an operator.`
      : `${updated.username} is now a platform ${role}.`,
  );

  Deno.exit(0);
}

export async function grantRole(): Promise<void> {
  const username = argumentAfter("--grant-role");
  const role = Deno.args[Deno.args.indexOf("--grant-role") + 2];

  if (username === undefined || role === undefined) {
    fail(
      `Usage: --grant-role <username> <${PLATFORM_ROLES.join("|")}>`,
    );
  }

  if (!PLATFORM_ROLES.includes(role as PlatformRole)) {
    fail(`"${role}" is not a role. Use one of ${PLATFORM_ROLES.join(", ")}.`);
  }

  await setRole(username, role as PlatformRole);
}

export async function revokeRole(): Promise<void> {
  const username = argumentAfter("--revoke-role");

  if (username === undefined) {
    fail("Usage: --revoke-role <username>");
  }

  await setRole(username, null);
}
