import { after, test } from "node:test";
import assert from "node:assert/strict";

// SHA1("password") = 5BAA6 1E4C9B93F3F0682250B6CF8331B7EE68FD8, as the API returned it.
const PREFIX = "5BAA6";
const SUFFIX = "1E4C9B93F3F0682250B6CF8331B7EE68FD8";

/** Padding, counted zero, exactly as the real service pads its answers. */
const PADDING = "0164EC3D5F2C6B4E4B5F4C1B9D3F7A8C9D0:0\r\n";

let answering: "range" | "error" = "range";
const asked: string[] = [];

const server = Deno.serve({ port: 0, onListen: () => {} }, (request) => {
  const prefix = new URL(request.url).pathname.split("/").at(-1) ?? "";
  asked.push(prefix);

  if (answering === "error") {
    return new Response("no", { status: 500 });
  }
  return new Response(
    prefix === PREFIX ? `${SUFFIX}:52372427\r\n${PADDING}` : PADDING,
  );
});

// The service reads its URL once, at import, so the server has to exist before it is loaded.
Deno.env.set("PWNED_PASSWORDS_URL", `http://localhost:${server.addr.port}`);
const { BreachedPasswordService, parseRange } = await import(
  "./breached_password_service.ts"
);

/** Shaped like the real answer: CRLF, with a padded entry among the real ones. */
const BODY = [
  "003CD215739D7C1B2218670D26F81408237:2",
  `${SUFFIX}:52372427`,
  "0164EC3D5F2C6B4E4B5F4C1B9D3F7A8C9D0:0",
].join("\r\n");

test("a suffix in the answer is a breach", () => {
  assert.equal(parseRange(BODY, SUFFIX), true);
});

test("a suffix that is not there is not", () => {
  assert.equal(parseRange(BODY, "F".repeat(35)), false);
});

/** The one that matters: a padded entry is not a leak. */
test("a padded entry is not a breach", () => {
  assert.equal(parseRange(BODY, "0164EC3D5F2C6B4E4B5F4C1B9D3F7A8C9D0"), false);
});

test("the answer is CRLF, so the count must survive the line ending", () => {
  assert.equal(parseRange(`${SUFFIX}:2\r\n`, SUFFIX), true);
});

test("a malformed line is passed over rather than thrown on", () => {
  assert.equal(parseRange(`nonsense\r\n\r\n:::\r\n${SUFFIX}:7`, SUFFIX), true);
  assert.equal(parseRange("nonsense\r\n", SUFFIX), false);
});

test("the API answers in upper case, and so does the hash", () => {
  assert.equal(parseRange(`${SUFFIX.toLowerCase()}:9`, SUFFIX), true);
});

/** What the pure tests cannot see: that the five sent and the thirty-five kept are not swapped. */
test("the prefix is sent and the suffix is matched", async () => {
  assert.equal(await BreachedPasswordService.isBreached("password"), true);
  assert.equal(
    await BreachedPasswordService.isBreached("nobody-has-leaked-this"),
    false,
  );
  // Five out, thirty-five kept: any other split would ask for a prefix of another length.
  assert.deepEqual(asked, [PREFIX, "6F2D5"]);
});

/** A service that is down must not stop anybody choosing a password. */
test("a refusal lets the password through", async () => {
  answering = "error";
  try {
    assert.equal(await BreachedPasswordService.isBreached("password"), false);
  } finally {
    answering = "range";
  }
});

// Not symmetrical with the setup above, which has to run before the tests are registered —
// earlier than any hook.
after(() => server.shutdown());
