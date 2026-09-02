import { z } from "@hono/zod-openapi";
import { notBlank } from "@/src/http/request_schema.ts";
import { TEXT_LIMIT } from "@/src/text_limit.ts";
import { WRITING_FOLDER_SCHEMA } from "@/src/database/schema.ts";

/** Shared so a create and a rename cannot drift apart on what a folder may be called. */
export const FOLDER_TITLE_SCHEMA = notBlank(
  WRITING_FOLDER_SCHEMA.shape.title.min(1).max(TEXT_LIMIT.folderTitle),
);

/**
 * Null clears it, which is the only way back to no description. Blank is refused rather than
 * treated as null: it would leave a row holding whitespace that renders as an empty line.
 */
export const FOLDER_DESCRIPTION_SCHEMA = notBlank(
  z.string().min(1).max(TEXT_LIMIT.folderDescription),
).nullable();
