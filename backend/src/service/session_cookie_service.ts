import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { SESSION_LIFETIME, UserSession } from "./user_service.ts";
import { getRequiredEnvVariable } from "@/src/util/env.ts";
import { formatToken, parseToken } from "@/src/util/token.ts";

const SESSION_COOKIE_KEY = "session";

/**
 * Taken from the configured host rather than from the request, because in production the
 * reverse proxy terminates TLS and forwards plain HTTP — deriving it from the request would
 * silently drop the flag exactly where it matters. Over http:// the browser would refuse to
 * store the cookie at all, which is what development runs on.
 */
const USE_SECURE_COOKIE =
  new URL(getRequiredEnvVariable("HOST_URL")).protocol === "https:";

function getUserSession(c: Context): UserSession | undefined {
  const sessionCookie = getCookie(c, SESSION_COOKIE_KEY);
  if (!sessionCookie) {
    return undefined;
  }

  const parsed = parseToken(sessionCookie);

  if (parsed === undefined) {
    return undefined;
  }

  return { id: parsed.id, token: parsed.secret };
}

function setUserSession(c: Context, userSession: UserSession): void {
  setCookie(c, "session", formatToken(userSession.id, userSession.token), {
    httpOnly: true,
    secure: USE_SECURE_COOKIE,
    sameSite: "Lax",
    path: "/",
    // Must match the database session lifetime, otherwise the browser keeps sending
    // a cookie whose session has already expired.
    maxAge: SESSION_LIFETIME.total("seconds"),
  });
}

function deleteUserSession(c: Context): void {
  deleteCookie(c, SESSION_COOKIE_KEY);
}

export const SessionCookieService = {
  getUserSession,
  setUserSession,
  deleteUserSession,
};
