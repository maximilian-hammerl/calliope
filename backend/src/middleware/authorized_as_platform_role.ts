import { createMiddleware } from "hono/factory";
import type { User } from "@/src/service/user_service.ts";
import {
  mayAdministerPlatform,
  mayModeratePlatform,
} from "@/src/service/platform_authorization.ts";

/**
 * Authorization only: these say what an already-authenticated member may do, and are listed
 * after an authentication middleware.
 *
 *     middleware: [authenticated, authorizedAsModerator] as const,
 *
 * The `as const` is load-bearing — see AGENTS.md. The role itself costs no query: it rides on
 * the session user, which is why it is a column rather than a table.
 *
 * 403 for a missing role, the same reason the verification wall answers 403: the session is
 * perfectly good, and "unauthorised" would send the client back to a sign-in page that would
 * not help. It says nothing about whether the route exists — the repository is public, so a
 * 404 would hide nothing worth hiding.
 */
function authorizedAs(permitted: (role: User["platformRole"]) => boolean) {
  return createMiddleware<{ Variables: { user: User } }>(async (c, next) => {
    // Defensive: reachable only by listing this without an authentication middleware before
    // it, which would otherwise throw on undefined and answer 500 instead of refusing.
    const user = c.get("user") as User | undefined;

    if (user === undefined) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    if (!permitted(user.platformRole)) {
      return c.json({ error: "Forbidden" }, 403);
    }

    await next();
    return;
  });
}

/** For acting on content and accounts: a moderator, or an administrator above them. */
export const authorizedAsModerator = authorizedAs(mayModeratePlatform);

/** For what changes the platform itself, granting a role included. */
export const authorizedAsAdministrator = authorizedAs(mayAdministerPlatform);
