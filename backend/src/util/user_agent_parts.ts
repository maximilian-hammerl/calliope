import { UserAgent } from "@std/http/user-agent";

/** A user agent as parts, never a sentence: the interface writes that in its own language. */
export type UserAgentParts = {
  browser: string | null;
  operatingSystem: string | null;
  /** "mobile", "tablet", … and null for a desktop, which the parser does not label. */
  deviceType: string | null;
  /** A brand name or nothing — never a placeholder, unlike the model's "K" on Android. */
  vendor: string | null;
};

export function userAgentParts(userAgent: string | null): UserAgentParts {
  if (userAgent === null || userAgent.trim() === "") {
    return {
      browser: null,
      operatingSystem: null,
      deviceType: null,
      vendor: null,
    };
  }

  const parsed = new UserAgent(userAgent);

  return {
    // Without the parser's "Mobile " prefix: `deviceType` already says that.
    browser: parsed.browser.name?.replace(/^Mobile /u, "") ?? null,
    operatingSystem: parsed.os.name ?? null,
    deviceType: parsed.device.type ?? null,
    vendor: parsed.device.vendor ?? null,
  };
}
