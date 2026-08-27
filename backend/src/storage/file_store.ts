import * as z from "zod";
import { getRequiredEnvVariable } from "@/src/util/env.ts";

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

async function write(fileId: string, bytes: Uint8Array): Promise<void> {
  const path = pathFor(fileId);
  await Deno.mkdir(DIRECTORY, { recursive: true });

  // Written aside and renamed, so a crash mid-write leaves no half a file under a name the
  // database already points at. `rename` is atomic within one filesystem.
  const partial = `${path}.partial`;
  try {
    await Deno.writeFile(partial, bytes);
    await Deno.rename(partial, path);
  } catch (error) {
    await Deno.remove(partial).catch(() => {});
    throw error;
  }
}

async function read(fileId: string): Promise<Uint8Array | undefined> {
  try {
    return await Deno.readFile(pathFor(fileId));
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return undefined;
    }
    throw error;
  }
}

/** Absent is success: the sweep and a delete race, and both want the file gone. */
async function remove(fileId: string): Promise<void> {
  try {
    await Deno.remove(pathFor(fileId));
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      throw error;
    }
  }
}

/** What the sweep compares against the database. Partials are in-flight writes, not orphans. */
async function listFileIds(): Promise<string[]> {
  const fileIds: string[] = [];
  try {
    for await (const entry of Deno.readDir(DIRECTORY)) {
      if (entry.isFile && FILE_ID_SCHEMA.safeParse(entry.name).success) {
        fileIds.push(entry.name);
      }
    }
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      throw error;
    }
  }
  return fileIds;
}

/** When the bytes last changed, which is how the sweep tells an orphan from an upload in flight. */
async function modifiedAt(
  fileId: string,
): Promise<Temporal.Instant | undefined> {
  try {
    const { mtime } = await Deno.stat(pathFor(fileId));
    return mtime === null
      ? undefined
      : Temporal.Instant.fromEpochMilliseconds(mtime.getTime());
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return undefined;
    }
    throw error;
  }
}

export const FileStore = { write, read, remove, listFileIds, modifiedAt };
