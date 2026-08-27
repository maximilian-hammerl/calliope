import { assertEquals, assertNotEquals } from "@std/assert";
import sharp from "sharp";
import { AVATAR_SIZE, toAvatar } from "./avatar_image.ts";

async function picture(
  options: { width: number; height: number; format: "png" | "jpeg" | "webp" },
): Promise<Uint8Array> {
  const base = sharp({
    create: {
      width: options.width,
      height: options.height,
      channels: 3,
      background: "#8a6a3a",
    },
  });
  const encoded = options.format === "png"
    ? await base.png().toBuffer()
    : options.format === "jpeg"
    ? await base.jpeg().toBuffer()
    : await base.webp().toBuffer();
  return new Uint8Array(encoded);
}

Deno.test("a photograph becomes one square WebP", async () => {
  const result = await toAvatar(
    await picture({ width: 800, height: 600, format: "jpeg" }),
  );
  assertNotEquals(result, undefined);

  const { format, width, height } = await sharp(result).metadata();
  assertEquals(format, "webp");
  assertEquals(width, AVATAR_SIZE);
  assertEquals(height, AVATAR_SIZE);
});

Deno.test("every accepted format is accepted", async () => {
  for (const format of ["png", "jpeg", "webp"] as const) {
    // deno-lint-ignore no-await-in-loop -- sequential on purpose, one case per iteration
    const source = await picture({ width: 300, height: 300, format });
    // deno-lint-ignore no-await-in-loop -- sequential on purpose, one case per iteration
    const result = await toAvatar(source);
    assertNotEquals(result, undefined, `${format} was refused`);
  }
});

/**
 * Two guards refuse it independently — the format allowlist and `sharp.block` — and each was
 * checked alone. libvips carries librsvg, so with both neutralised this renders.
 */
Deno.test("an SVG is refused", async () => {
  const svg = new TextEncoder().encode(
    `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>`,
  );
  assertEquals(await toAvatar(svg), undefined);
});

Deno.test("something that is not a picture is refused", async () => {
  assertEquals(
    await toAvatar(new TextEncoder().encode("not an image at all")),
    undefined,
  );
});

/** A few hundred bytes declaring billions of pixels, refused before anything is drawn. */
Deno.test("a decompression bomb is refused", async () => {
  const bomb = new TextEncoder().encode(
    `<svg xmlns="http://www.w3.org/2000/svg" width="50000" height="50000"><rect width="100%" height="100%"/></svg>`,
  );
  assertEquals(await toAvatar(bomb), undefined);
});

/** Re-encoding is what strips it, which matters because a phone photograph carries coordinates. */
Deno.test("metadata does not survive", async () => {
  const withExif = new Uint8Array(
    await sharp({
      create: { width: 400, height: 400, channels: 3, background: "#ffffff" },
    })
      .withExif({
        IFD0: { Copyright: "somebody else", Artist: "somebody else" },
      })
      .jpeg()
      .toBuffer(),
  );
  assertNotEquals((await sharp(withExif).metadata()).exif, undefined);

  const result = await toAvatar(withExif);
  assertEquals((await sharp(result).metadata()).exif, undefined);
});

/**
 * A phone stores a rotated photograph as-shot plus an EXIF tag, and re-encoding drops the tag — so
 * without `.rotate()` the picture arrives turned a quarter.
 */
Deno.test("a picture is turned the way its EXIF says", async () => {
  const half = (colour: string) =>
    sharp({
      create: { width: 200, height: 200, channels: 3, background: colour },
    }).png()
      .toBuffer();

  // Wide, red beside blue, tagged "display me rotated 90° clockwise" — so red belongs on top.
  const wide = await sharp({
    create: { width: 400, height: 200, channels: 3, background: "#000000" },
  })
    .composite([
      { input: await half("#ff0000"), left: 0, top: 0 },
      { input: await half("#0000ff"), left: 200, top: 0 },
    ])
    .withMetadata({ orientation: 6 })
    .jpeg()
    .toBuffer();

  const result = await toAvatar(new Uint8Array(wide));
  const { data, info } = await sharp(result).raw().toBuffer({
    resolveWithObject: true,
  });

  const redness = (from: number, to: number) => {
    let red = 0, blue = 0;
    for (let y = from; y < to; y++) {
      for (let x = 0; x < info.width; x++) {
        const at = (y * info.width + x) * info.channels;
        red += data[at] ?? 0;
        blue += data[at + 2] ?? 0;
      }
    }
    return red > blue;
  };

  assertEquals(redness(0, 80), true, "the top should be red");
  assertEquals(redness(112, info.height), false, "the bottom should be blue");
});
