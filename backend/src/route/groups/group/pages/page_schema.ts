import { notBlank } from "@/src/http/request_schema.ts";
import { TEXT_LIMIT } from "@/src/text_limit.ts";
import { WRITING_PAGE_SCHEMA } from "@/src/database/schema.ts";

/** Shared so a create and an edit cannot drift apart on what a title may be. */
export const PAGE_TITLE_SCHEMA = notBlank(
  WRITING_PAGE_SCHEMA.shape.title.min(1).max(TEXT_LIMIT.pageTitle),
);
