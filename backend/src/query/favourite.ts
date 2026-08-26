import type { AnyColumnWithTable, SelectQueryBuilder } from "kysely";
import type { DB, Favourite } from "@/src/database/schema.ts";
import type { SortTerm } from "@/src/list/list_endpoint_query.ts";

/**
 * **Import nothing from `service/` here.** Every service that joins `favourite` imports this, and
 * `favourite_service` reaches them back through `visible_target` — so an import in this direction
 * closes a cycle, and TypeScript answers a cycle with `any` rather than an error: the join column
 * silently stops being checked. Nothing enforces this; Deno's lint has no cycle rule.
 *
 * What a favourite can name, where each kind's id goes, and how to join one.
 */
export const FAVOURITE_TARGET_TYPES = [
  "writing_group",
  "writing_thread",
  "writing_post",
  "story_idea",
  "chat_group",
] as const;

export type FavouriteTargetType = (typeof FAVOURITE_TARGET_TYPES)[number];

/**
 * The column each kind's id goes in. `satisfies` is what makes adding a kind a compile error
 * naming it rather than a row nothing can find, and typing the values as `keyof Favourite` means
 * a renamed column fails here rather than at run time.
 */
export const FAVOURITE_COLUMN = {
  writing_group: "writingGroupId",
  writing_thread: "writingThreadId",
  writing_post: "writingPostId",
  story_idea: "storyIdeaId",
  chat_group: "chatGroupId",
} as const satisfies Record<FavouriteTargetType, keyof Favourite>;

/**
 * The alias every list selects the flag under, and the one `listResultsWithCount` orders by to
 * float favourites to the top. One constant, because the two have to agree and nothing else would
 * notice if they stopped.
 */
export const IS_FAVOURITE = "isFavourite";

/** Ahead of whatever a list is sorted by — `true` sorts above `false`, so descending. */
export const FAVOURITES_FIRST: SortTerm = {
  attribute: IS_FAVOURITE,
  order: "desc",
};

/**
 * The reader's own favourite, joined and selected as `isFavourite`.
 *
 * One place, because `.on("favourite.userId", "=", readerId)` is what scopes a favourite to the
 * member reading: written out per service, a copy that lost it would report everybody's favourites
 * as the reader's own, on a list that draws a star. It was written out eight times before this.
 */
/**
 * The same map as a qualified reference, which is what `onRef` takes. Derived rather than written
 * out again, so the two cannot disagree: a template literal built inline widens to `string` and
 * Kysely refuses it.
 */
const FAVOURITE_REFERENCE = Object.fromEntries(
  FAVOURITE_TARGET_TYPES.map((kind) => [
    kind,
    `favourite.${FAVOURITE_COLUMN[kind]}`,
  ]),
) as {
  [Kind in FavouriteTargetType]: `favourite.${typeof FAVOURITE_COLUMN[Kind]}`;
};

export function withFavourite<TB extends keyof DB, Output>(
  queryBuilder: SelectQueryBuilder<DB, TB, Output>,
  kind: FavouriteTargetType,
  targetId: AnyColumnWithTable<DB, TB>,
  readerId: string,
) {
  // Kysely cannot resolve a reference against a table set it has not seen yet, so a helper generic
  // over the builder has to assert them. The casts are the price of writing the join once; every
  // call site stays checked, and the reader scoping cannot be left out of one.
  return queryBuilder
    .leftJoin(
      "favourite",
      (join) =>
        join
          .onRef(FAVOURITE_REFERENCE[kind] as never, "=", targetId as never)
          .on("favourite.userId" as never, "=", readerId as never),
    )
    .select((eb) =>
      eb("favourite.id" as never, "is not", null).$castTo<boolean>().as(
        IS_FAVOURITE,
      )
    );
}

/**
 * `only` narrows a list to the reader's own favourites. An enum rather than a boolean, matching
 * `status` and `readerState` beside it: a list that grows a third case then has somewhere to put
 * it without changing shape.
 */
export type FavouriteFilter = "only" | "any";
