import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import * as z from "zod";
import { getRequiredEnvVariable } from "#/src/util/env.ts";

/**
 * Files a member uploaded, on disk rather than in a column — see #94. The database holds the
 * reference; this holds the bytes, and the two can disagree, which the sweep resolves.
 */
const DIRECTORY = getRequiredEnvVariable("FILE_STORAGE_PATH");

/**
 * Every file is named by a uuid, so a path built here cannot leave the directory. The column is
 * `uuid` too, so this is the second lock.
 */
const FILE_ID_SCHEMA = z.uuidv7();

function pathFor(fileId: string): string {
  const parsed = FILE_ID_SCHEMA.safeParse(fileId);
  if (!parsed.success) {
    throw new Error(`Not a file id: ${fileId}`);
  }
  return `${DIRECTORY}/${parsed.data}`;
}

function isNotFound(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

async function write(fileId: string, bytes: Uint8Array): Promise<void> {
  const path = pathFor(fileId);
  await mkdir(DIRECTORY, { recursive: true });

  // Written aside and renamed, so a crash mid-write leaves no half a file under a name the
  // database already points at. `rename` is atomic within one filesystem.
  const partial = `${path}.partial`;
  try {
    await writeFile(partial, bytes);
    await rename(partial, path);
  } catch (error) {
    await rm(partial, { force: true });
    throw error;
  }
}

async function read(fileId: string): Promise<Uint8Array | undefined> {
  try {
    // A Uint8Array rather than Node's Buffer, which compares unequal to one with the same bytes.
    const buffer = await readFile(pathFor(fileId));
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  } catch (error) {
    if (isNotFound(error)) {
      return undefined;
    }
    throw error;
  }
}

/** Absent is success: the sweep and a delete race, and both want the file gone. */
async function remove(fileId: string): Promise<void> {
  await rm(pathFor(fileId), { force: true });
}

/** What the sweep compares against the database. Partials are in-flight writes, not orphans. */
async function listFileIds(): Promise<string[]> {
  const fileIds: string[] = [];
  try {
    for (const entry of await readdir(DIRECTORY, { withFileTypes: true })) {
      if (entry.isFile() && FILE_ID_SCHEMA.safeParse(entry.name).success) {
        fileIds.push(entry.name);
      }
    }
  } catch (error) {
    if (!isNotFound(error)) {
      throw error;
    }
  }
  return fileIds;
}

/** When the bytes last changed, which is how the sweep tells an orphan from an upload in flight. */
async function modifiedAt(fileId: string): Promise<Temporal.Instant | undefined> {
  try {
    const { mtime } = await stat(pathFor(fileId));
    return Temporal.Instant.fromEpochMilliseconds(mtime.getTime());
  } catch (error) {
    if (isNotFound(error)) {
      return undefined;
    }
    throw error;
  }
}

export const FileStore = { write, read, remove, listFileIds, modifiedAt };
