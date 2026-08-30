import { generate as uuidv7 } from "@std/uuid/v7";
import { db } from "@/src/database/client.ts";
import type { AvatarOrigin } from "@/src/database/schema.ts";
import { toAvatar } from "@/src/image/avatar_image.ts";
import { FileStore } from "@/src/storage/file_store.ts";

export type Avatar = {
  fileId: string;
  origin: AvatarOrigin;
  credit: string | null;
};

export type SetAvatarResult =
  | { kind: "set"; fileId: string }
  | { kind: "not_an_image" };

async function selectAvatar(userId: string): Promise<Avatar | undefined> {
  return await db
    .selectFrom("userAvatar")
    .select(["fileId", "origin", "credit"])
    .where("userId", "=", userId)
    .executeTakeFirst();
}

/**
 * Bytes before the row: a failure between them leaves an orphan the sweep collects, where the other
 * order leaves a broken picture. The previous file is left to the sweep too.
 */
async function setAvatar(
  userId: string,
  bytes: Uint8Array,
  declaration: { origin: AvatarOrigin; credit: string | null },
): Promise<SetAvatarResult> {
  const image = await toAvatar(bytes);
  if (image === undefined) {
    return { kind: "not_an_image" };
  }

  // v7 like every other id here, and like the column's own default.
  const fileId = uuidv7();
  await FileStore.write(fileId, image);

  await db
    .insertInto("userAvatar")
    .values({
      userId,
      fileId,
      origin: declaration.origin,
      credit: declaration.credit,
    })
    .onConflict((conflict) =>
      conflict.column("userId").doUpdateSet({
        fileId,
        origin: declaration.origin,
        credit: declaration.credit,
        createdAt: Temporal.Now.instant().toString(),
      })
    )
    .execute();

  return { kind: "set", fileId };
}

/** The bytes outlive the row so a restore cannot break; being *served* must not. */
async function isInUse(fileId: string): Promise<boolean> {
  const row = await db
    .selectFrom("userAvatar")
    .select("fileId")
    .where("fileId", "=", fileId)
    .executeTakeFirst();
  return row !== undefined;
}

async function deleteAvatar(userId: string): Promise<boolean> {
  const result = await db
    .deleteFrom("userAvatar")
    .where("userId", "=", userId)
    .executeTakeFirst();
  return result.numDeletedRows > 0n;
}

/**
 * One day longer than `RETENTION_DAYS` in `deployment/backup.sh`, so a restored dump cannot name a
 * swept file. Raise that and this has to follow. Hours, because an `Instant` has no calendar.
 */
const UNREFERENCED_GRACE = Temporal.Duration.from({ hours: 15 * 24 });

/** Files the database no longer names. Never deleted inline — see the note on `setAvatar`. */
async function sweepUnreferencedFiles(): Promise<number> {
  const onDisk = await FileStore.listFileIds();
  if (onDisk.length === 0) {
    return 0;
  }

  const referenced = new Set(
    (await db.selectFrom("userAvatar").select("fileId").execute()).map((row) =>
      row.fileId
    ),
  );

  const deleteBefore = Temporal.Now.instant().subtract(UNREFERENCED_GRACE);
  let deleted = 0;

  for (const fileId of onDisk) {
    if (referenced.has(fileId)) {
      continue;
    }

    // deno-lint-ignore no-await-in-loop -- a background pass, so nothing to gain from parallelism
    const changedAt = await FileStore.modifiedAt(fileId);
    if (
      changedAt === undefined ||
      Temporal.Instant.compare(changedAt, deleteBefore) > 0
    ) {
      continue;
    }

    // deno-lint-ignore no-await-in-loop -- as above
    await FileStore.remove(fileId);
    deleted += 1;
  }

  return deleted;
}

export const UserAvatarService = {
  selectAvatar,
  isInUse,
  setAvatar,
  deleteAvatar,
  sweepUnreferencedFiles,
};
