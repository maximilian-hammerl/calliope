import { assertEquals, assertExists } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import sharp from "sharp";
import app from "@/src/app.ts";
import {
  clearRateLimits,
  deleteUsers,
  registerUser,
  SAME_ORIGIN,
} from "@/src/test/support.ts";

const OWNER = "avatar-route-owner";
const OTHER = "avatar-route-other";

Deno.test.beforeEach(clearRateLimits);
Deno.test.afterEach(() => deleteUsers([OWNER, OTHER]));

async function picture(): Promise<Uint8Array> {
  return new Uint8Array(
    await sharp({
      create: { width: 400, height: 300, channels: 3, background: "#8a6a3a" },
    }).png().toBuffer(),
  );
}

async function upload(
  cookie: string,
  parts: { image?: Uint8Array; origin?: string; credit?: string },
): Promise<Response> {
  const form = new FormData();
  if (parts.image !== undefined) {
    form.append(
      "image",
      new File([parts.image as BufferSource], "a.png", { type: "image/png" }),
    );
  }
  form.append("origin", parts.origin ?? "own_work");
  if (parts.credit !== undefined) {
    form.append("credit", parts.credit);
  }
  form.append("confirmed", "true");
  return await app.request("/api/users/me/avatar", {
    method: "PUT",
    headers: { cookie, ...SAME_ORIGIN },
    body: form,
  });
}

Deno.test("a member sets a picture and it is served back", async () => {
  const cookie = await registerUser(OWNER);
  const response = await upload(cookie, { image: await picture() });
  assertEquals(response.status, STATUS_CODE.OK);

  const { avatarUrl } = await response.json();
  assertExists(avatarUrl);

  const served = await app.request(avatarUrl, { headers: { cookie } });
  assertEquals(served.status, STATUS_CODE.OK);
  assertEquals(served.headers.get("content-type"), "image/webp");
  assertEquals(
    served.headers.get("cache-control"),
    // Short on purpose: this is how long a *withdrawn* picture can linger in a cache.
    "private, max-age=3600, immutable",
  );

  const { format } = await sharp(new Uint8Array(await served.arrayBuffer()))
    .metadata();
  assertEquals(format, "webp");
});

Deno.test("what is not a picture is refused", async () => {
  const cookie = await registerUser(OWNER);
  const response = await upload(cookie, {
    image: new TextEncoder().encode("not a picture"),
  });
  assertEquals(response.status, STATUS_CODE.UnprocessableEntity);
});

/** The table's CHECK says the same thing; the route says it so a member is told rather than 500ed. */
Deno.test("a picture that is not the member's own has to be credited", async () => {
  const cookie = await registerUser(OWNER);
  const response = await upload(cookie, {
    image: await picture(),
    origin: "licence",
  });
  assertEquals(response.status, STATUS_CODE.BadRequest);

  const credited = await upload(cookie, {
    image: await picture(),
    origin: "licence",
    credit: "CC BY 4.0, Foto: jemand",
  });
  assertEquals(credited.status, STATUS_CODE.OK);
});

Deno.test("a picture without a session is refused, and so is reading one", async () => {
  const cookie = await registerUser(OWNER);
  const { avatarUrl } = await (await upload(cookie, { image: await picture() }))
    .json();

  assertEquals(
    (await app.request("/api/users/me/avatar", {
      method: "PUT",
      headers: SAME_ORIGIN,
      body: new FormData(),
    })).status,
    STATUS_CODE.Unauthorized,
  );
  assertEquals((await app.request(avatarUrl)).status, STATUS_CODE.Unauthorized);
});

/** Nothing about a picture is private between members, but everything is behind a session. */
Deno.test("another member can read the picture", async () => {
  const owner = await registerUser(OWNER);
  const { avatarUrl } = await (await upload(owner, { image: await picture() }))
    .json();

  const other = await registerUser(OTHER);
  assertEquals(
    (await app.request(avatarUrl, { headers: { cookie: other } })).status,
    STATUS_CODE.OK,
  );
});

Deno.test("removing it leaves nothing to serve", async () => {
  const cookie = await registerUser(OWNER);
  const { avatarUrl } = await (await upload(cookie, { image: await picture() }))
    .json();

  const removed = await app.request("/api/users/me/avatar", {
    method: "DELETE",
    headers: { cookie, ...SAME_ORIGIN },
  });
  assertEquals(removed.status, STATUS_CODE.OK);

  // Idempotent: the second one answers the same.
  const again = await app.request("/api/users/me/avatar", {
    method: "DELETE",
    headers: { cookie, ...SAME_ORIGIN },
  });
  assertEquals(again.status, STATUS_CODE.OK);

  // The file is still on disk for the sweep to collect, but nothing serves it any more.
  assertEquals(
    (await app.request(avatarUrl, { headers: { cookie } })).status,
    STATUS_CODE.NotFound,
  );
});

Deno.test("a picture that is not there is not found", async () => {
  const cookie = await registerUser(OWNER);
  const response = await app.request(
    "/api/avatars/01a00000-0000-7000-8000-0000000000ff",
    { headers: { cookie } },
  );
  assertEquals(response.status, STATUS_CODE.NotFound);
});
