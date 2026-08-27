import sharp from "sharp";

/** The allowlist below refuses SVG too; this is the second lock, and never decodes it at all. */
sharp.block({ operation: ["VipsForeignLoadSvg"] });

/** One stored size: `UserAvatar` renders at 28px and 48px, which this covers at 2×. */
export const AVATAR_SIZE = 192;

/**
 * Decided after decoding rather than from the upload's declared type, so the set is a statement
 * rather than an accident of which loaders this build happens to carry.
 */
const ACCEPTED_FORMATS: ReadonlySet<string> = new Set(["jpeg", "png", "webp"]);

/**
 * One square WebP, or `undefined` for anything that is not a picture we accept. Re-encoding is
 * also what strips EXIF, and a phone photograph carries where it was taken.
 */
export async function toAvatar(
  bytes: Uint8Array,
): Promise<Uint8Array | undefined> {
  try {
    const image = sharp(bytes);
    const { format } = await image.metadata();
    if (format === undefined || !ACCEPTED_FORMATS.has(format)) {
      return undefined;
    }

    const webp = await image
      // Before the resize, and not optional: a phone stores a rotated photograph as-shot plus an
      // EXIF tag, and re-encoding drops the tag — so without this the picture comes out turned.
      .rotate()
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover" })
      .webp({ quality: 82 })
      .toBuffer();
    return new Uint8Array(webp);
  } catch {
    // libvips refuses a corrupt or oversized image by throwing; to a caller that is the same
    // answer as an unaccepted format.
    return undefined;
  }
}
