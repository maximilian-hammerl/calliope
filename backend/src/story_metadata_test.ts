import { assertEquals, assertLessOrEqual } from "@std/assert";
import {
  STORY_CONTENT_WARNINGS,
  STORY_GENRES,
  STORY_SUBGENRES,
  STORY_TROPES,
} from "@/src/database/schema.ts";
import { LIST_LIMIT } from "@/src/text_limit.ts";
import {
  SUBGENRE_GENRE,
  subgenresOutsideGenres,
} from "@/src/story_metadata.ts";

/**
 * A board offers every value it has, so a filter has to be able to ask for every value. The two
 * were the same number once — twelve, the bound on how many a *story* may claim — and a member
 * picking a thirteenth genre got a 400 that took the filters off the page with the list.
 *
 * Related here by something that fails rather than by the comment beside the number: the beta
 * round added twenty-six subgenres in one go, so "seventy-six will not reach a hundred" is an
 * assumption with a history of moving.
 */
Deno.test("a filter may ask for every value its vocabulary holds", () => {
  const vocabularies = {
    genres: STORY_GENRES,
    subgenres: STORY_SUBGENRES,
    tropes: STORY_TROPES,
    contentWarnings: STORY_CONTENT_WARNINGS,
  };

  for (const [name, values] of Object.entries(vocabularies)) {
    assertLessOrEqual(
      values.length,
      LIST_LIMIT.storyVocabularyFilter,
      `${name} has outgrown the bound a filter may ask under`,
    );
  }
});

/**
 * Every subgenre is placed, which the `satisfies` on the map already guarantees, and placed under
 * a genre that exists — which it does not: a typo'd genre would be a string the enum never had.
 */
Deno.test("every subgenre sits under a genre that exists", () => {
  const genres = new Set<string>(STORY_GENRES);

  assertEquals(Object.keys(SUBGENRE_GENRE).length, STORY_SUBGENRES.length);

  for (const [subgenre, genre] of Object.entries(SUBGENRE_GENRE)) {
    assertEquals(genres.has(genre), true, `${subgenre} names no genre`);
  }
});

Deno.test("subgenresOutsideGenres names only what is unaccounted for", () => {
  assertEquals(
    subgenresOutsideGenres(["fantasy"], ["dark_fantasy"]),
    [],
  );
  assertEquals(
    subgenresOutsideGenres(["romance"], [
      "space_opera",
      "contemporary_romance",
    ]),
    ["space_opera"],
  );
  // Nothing chosen narrows nothing, which is what an untouched form sends.
  assertEquals(subgenresOutsideGenres([], []), []);
});
