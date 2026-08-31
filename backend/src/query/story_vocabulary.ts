import type { SelectQueryBuilder } from "kysely";
import type {
  DB,
  StoryGenre,
  StorySubgenre,
  StoryTrope,
} from "@/src/database/schema.ts";

/**
 * What a member may narrow a board by. Absent means "not asked", never "none" — the same rule the
 * request schemas follow, so a filter left untouched cannot empty a list.
 */
export type StoryVocabularyFilter = {
  genres?: StoryGenre[];
  subgenres?: StorySubgenre[];
  tropes?: StoryTrope[];
};

/**
 * The columns, qualified per table. Written out rather than built from a template literal, which
 * widens to `string` and Kysely then refuses — the same reason `favourite.ts` derives its map.
 */
const COLUMNS = {
  writingGroup: {
    genres: "writingGroup.genres",
    subgenres: "writingGroup.subgenres",
    tropes: "writingGroup.tropes",
  },
  storyIdea: {
    genres: "storyIdea.genres",
    subgenres: "storyIdea.subgenres",
    tropes: "storyIdea.tropes",
  },
} as const;

const chosen = (values: readonly string[] | undefined): boolean =>
  values !== undefined && values.length > 0;

/**
 * Narrows a board to what carries any of the chosen values. `&&` is overlap, so picking Fantasy
 * *and* Romance widens within a field — somebody browsing two genres wants either — while the
 * three fields narrow against each other: fantasy ideas that are also slow burn.
 *
 * `eb.val` is what makes the array an array. A bare `["fantasy"]` becomes a row constructor and
 * Postgres answers `operator does not exist: story_genre[] && record`.
 *
 * One place for both boards, because `writing_group` and `story_idea` share these columns column
 * for column and a filter that drifted would offer neighbours the other list hides.
 */
export function withStoryVocabulary<TB extends keyof DB, Output>(
  queryBuilder: SelectQueryBuilder<DB, TB, Output>,
  table: keyof typeof COLUMNS,
  filter: StoryVocabularyFilter,
) {
  const column = COLUMNS[table];

  // Kysely cannot resolve a reference against a table set it has not seen, so a helper generic
  // over the builder must assert them — the same price `withFavourite` pays for its join.
  return queryBuilder
    .$if(
      chosen(filter.genres),
      (builder) =>
        builder.where((eb) =>
          eb(
            eb.ref(column.genres as never),
            "&&",
            eb.val(filter.genres) as never,
          )
        ),
    )
    .$if(chosen(filter.subgenres), (builder) =>
      builder.where((eb) =>
        eb(
          eb.ref(column.subgenres as never),
          "&&",
          eb.val(filter.subgenres) as never,
        )
      ))
    .$if(
      chosen(filter.tropes),
      (builder) =>
        builder.where((eb) =>
          eb(
            eb.ref(column.tropes as never),
            "&&",
            eb.val(filter.tropes) as never,
          )
        ),
    );
}
