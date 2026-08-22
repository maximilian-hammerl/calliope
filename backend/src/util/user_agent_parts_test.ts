import { assertEquals } from "@std/assert";
import { userAgentParts } from "@/src/util/user_agent_parts.ts";

Deno.test("userAgentParts drops the parser's Mobile prefix, which deviceType already carries", () => {
  assertEquals(
    userAgentParts(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    ),
    {
      browser: "Safari",
      operatingSystem: "iOS",
      deviceType: "mobile",
      vendor: "Apple",
    },
  );
});

Deno.test("userAgentParts leaves a desktop unlabelled rather than inventing a device type", () => {
  assertEquals(
    userAgentParts(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    ),
    {
      browser: "Chrome",
      operatingSystem: "Windows",
      deviceType: null,
      vendor: null,
    },
  );
});

Deno.test("userAgentParts names the vendor where the model would only give a placeholder", () => {
  // "K" is what Chrome's user-agent reduction puts where the Android model used to be.
  assertEquals(
    userAgentParts(
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
    ).vendor,
    "Google",
  );
  assertEquals(
    userAgentParts(
      "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
    ).vendor,
    null,
  );
});

Deno.test("userAgentParts answers all-null for a client it cannot read, and for none at all", () => {
  const nothing = {
    browser: null,
    operatingSystem: null,
    deviceType: null,
    vendor: null,
  };
  assertEquals(userAgentParts("curl/8.7.1"), nothing);
  assertEquals(userAgentParts(null), nothing);
  assertEquals(userAgentParts("   "), nothing);
});
