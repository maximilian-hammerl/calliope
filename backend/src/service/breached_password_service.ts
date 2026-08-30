import { createHash } from "node:crypto";
import { APP_NAME } from "@/src/branding.ts";
import { getRequiredEnvVariable } from "@/src/util/env.ts";
import { describeError, logger } from "@/src/logging.ts";

/**
 * Whether a password is already in circulation, asked of Have I Been Pwned. Only the first five
 * characters of its SHA-1 go out; the other thirty-five are matched here.
 *
 * Required rather than defaulted, so reaching a third party is something a deployment states.
 */
const PWNED_PASSWORDS_URL = getRequiredEnvVariable("PWNED_PASSWORDS_URL");

const TIMEOUT = Temporal.Duration.from({ seconds: 2 });

/**
 * `SUFFIX:COUNT` per line, CRLF-delimited. `Add-Padding` mixes in entries counted zero, and
 * reading those as hits would refuse arbitrary passwords.
 */
export function parseRange(body: string, suffix: string): boolean {
  for (const line of body.split("\n")) {
    const [candidate, count] = line.trim().split(":");
    if (candidate?.toUpperCase() === suffix && Number(count) > 0) {
      return true;
    }
  }
  return false;
}

/** `undefined` when the answer did not arrive: a service that is down must not stop anybody. */
async function fetchRange(prefix: string): Promise<string | undefined> {
  try {
    const response = await fetch(`${PWNED_PASSWORDS_URL}/${prefix}`, {
      headers: { "Add-Padding": "true", "User-Agent": APP_NAME },
      signal: AbortSignal.timeout(TIMEOUT.total("milliseconds")),
    });

    if (!response.ok) {
      logger.warn("Breach check refused", { status: response.status });
      return undefined;
    }

    // Inside the `try`: the signal covers the body, and a stalled stream rejects here.
    return await response.text();
  } catch (error) {
    logger.warn("Breach check unavailable", describeError(error));
    return undefined;
  }
}

async function isBreached(password: string): Promise<boolean> {
  const hash = createHash("sha1").update(password).digest("hex").toUpperCase();
  const body = await fetchRange(hash.slice(0, 5));

  // Parsed outside the `catch`, so a fault of ours is not reported as an outage.
  return body === undefined ? false : parseRange(body, hash.slice(5));
}

/** Reached through the object, so the routes' tests can replace the method. */
export const BreachedPasswordService = { isBreached };
