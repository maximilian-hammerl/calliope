import { z } from "@hono/zod-openapi";
import {
  STORY_CONTENT_WARNING_SCHEMA,
  STORY_GENRE_SCHEMA,
  STORY_SUBGENRE_SCHEMA,
  STORY_TROPE_SCHEMA,
  WRITING_FOLDER_SCHEMA,
} from "@/src/database/schema.ts";
import { LIST_LIMIT, TEXT_LIMIT } from "@/src/text_limit.ts";

/**
 * The one definition of an acceptable email address. Every route that takes one uses this,
 * because the `pattern` is easy to leave off and nothing would notice: Zod's default is
 * *stricter* than the browser's, so an address the form accepted would be refused by the API
 * with no explanation the member could act on.
 *
 * The HTML5 pattern is what browsers apply to `input[type=email]`, so the form and the schema
 * agree exactly. It is deliberately permissive — `a@b` and `alice@localhost` pass — which is
 * the price of that agreement.
 *
 * Lower-cased on the way in, so the UNIQUE constraint cannot be sidestepped by changing case.
 */
export const EMAIL_ADDRESS_SCHEMA = z.email({ pattern: z.regexes.html5Email })
  .max(TEXT_LIMIT.emailAddress)
  .toLowerCase();

/**
 * Text that has to say something. `min(1)` counts characters, so „   " passes it — and the service
 * trims before storing, which turned a group's title into an empty string on the way through. The
 * browser already refuses it: `titleSchema` trims *before* checking, so without this the API takes
 * what the interface will not send.
 *
 * A pattern rather than a `.trim()` transform. Normalisation belongs in the service, where a
 * caller cannot skip it, and a transform in a request schema reaches `open-api.json` as a shape
 * the client cannot see — where `pattern` is a rule the document can state plainly.
 */
export const notBlank = <T extends z.ZodString>(schema: T) =>
  schema.regex(/\S/, "Must not be only whitespace");

/**
 * The story vocabularies — genres, subgenres, tropes, content warnings. Chosen from the database's
 * own enums rather than typed, which is what makes them filterable: „Enemies to Lovers" and
 * „enemies-to-lovers" were three tropes to a query and one to a reader.
 *
 * Optional rather than defaulted to empty. A default materialises the field even when the
 * client omitted it, which on a PATCH means every partial update silently clears the tags —
 * a test caught exactly that. Absent has to mean "unchanged"; the column defaults to empty
 * for a create.
 *
 * A repeat is refused rather than dropped. The values are closed, so sending one twice is a
 * client bug and nothing else — silently de-duplicating it would hide the bug and answer 200 to a
 * request the sender got wrong. The issue names the value and the position, like every other
 * field error here.
 *
 * **The `superRefine` and the `meta` are a pair.** A refinement does not reach `open-api.json` on
 * its own, which is why the report body is a union rather than a refine; `uniqueItems` is the one
 * JSON Schema word for this rule, so declaring it keeps the document honest. Drop either and the
 * two disagree — the specification would promise a rule nothing enforces, or hide one that bites.
 */
const storyValues = <T extends z.ZodType>(value: T, max: number) =>
  z
    .array(value)
    .max(max)
    .superRefine((values, ctx) => {
      const seen = new Set<unknown>();

      values.forEach((each, index) => {
        if (seen.has(each)) {
          ctx.addIssue({
            code: "custom",
            message: `Duplicate value: ${String(each)}`,
            path: [index],
          });
          return;
        }

        seen.add(each);
      });
    })
    .meta({ uniqueItems: true })
    .optional();

const TAGS = LIST_LIMIT.storyTags;
const FILTER = LIST_LIMIT.storyVocabularyFilter;

export const STORY_GENRES_SCHEMA = storyValues(STORY_GENRE_SCHEMA, TAGS);
export const STORY_SUBGENRES_SCHEMA = storyValues(STORY_SUBGENRE_SCHEMA, TAGS);
export const STORY_TROPES_SCHEMA = storyValues(STORY_TROPE_SCHEMA, TAGS);
export const STORY_CONTENT_WARNINGS_SCHEMA = storyValues(
  STORY_CONTENT_WARNING_SCHEMA,
  TAGS,
);

/**
 * The same values, bounded for asking rather than for claiming. A board's own vocabulary is
 * longer than any one story's, so the create body's bound refuses filters the interface offers.
 */
export const STORY_GENRES_FILTER = storyValues(STORY_GENRE_SCHEMA, FILTER);
export const STORY_SUBGENRES_FILTER = storyValues(
  STORY_SUBGENRE_SCHEMA,
  FILTER,
);
export const STORY_TROPES_FILTER = storyValues(STORY_TROPE_SCHEMA, FILTER);

/**
 * Shared so a create and a rename cannot drift apart on what a folder may be called - and shared
 * by two route trees, since the public forum names folders too (#32).
 */
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
