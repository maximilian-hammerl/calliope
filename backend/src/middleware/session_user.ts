import type { Context } from "hono";
import { type User, UserService } from "@/src/service/user_service.ts";
import { SessionCookieService } from "@/src/service/session_cookie_service.ts";

/**
 * Shared by the two session middlewares, which differ only in whether they also insist the
 * address has been verified. One copy, so a change to how a session is read cannot apply to
 * the strict path and not the permissive one.
 */
export async function resolveSessionUser(
  c: Context,
): Promise<User | undefined> {
  const sessionToken = SessionCookieService.getUserSession(c);

  if (sessionToken === undefined) {
    return undefined;
  }

  const user = await UserService.selectUserForSession(sessionToken);

  if (user === undefined) {
    SessionCookieService.deleteUserSession(c);
    return undefined;
  }

  return user;
}
