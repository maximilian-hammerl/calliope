import type { Context } from "hono";
import { clientAddress } from "@/src/util/client_address.ts";

/** Where a session came from. The user agent is kept as it arrived and parsed on read. */
export type SessionProvenance = {
  userAgent: string | undefined;
  ipAddress: string | undefined;
};

/**
 * Read from the request that is creating the session. Absent for a client that sends no user
 * agent, and for a test driving the app directly — a session without provenance is still a
 * session, just an unlabelled one.
 */
export function sessionProvenance(c: Context): SessionProvenance {
  return {
    userAgent: c.req.header("user-agent"),
    ipAddress: clientAddress(c),
  };
}
