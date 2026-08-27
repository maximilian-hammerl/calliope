import type { AnyColumnWithTable, SelectQueryBuilder } from "kysely";
import type { DB, Favourite } from "@/src/database/schema.ts";
import type { SortTerm } from "@/src/list/list_endpoint_query.ts";

/**
 * **Import nothing from `service/` here.** Services import this and reach back through
 * `visible_target`, and TypeScript answers a cycle with `any` — the join column stops being checked.
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
 * Where each kind's id goes. `satisfies` makes an added kind a compile error naming it, and a
 * renamed column fail here rather than at run time.
 */
export const FAVOURITE_COLUMN = {
  writing_group: "writingGroupId",
  writing_thread: "writingThreadId",
  writing_post: "writingPostId",
  story_idea: "storyIdeaId",
  chat_group: "chatGroupId",
} as const satisfies Record<FavouriteTargetType, keyof Favourite>;

/** One constant, because the select alias and the sort term have to agree and nothing checks. */
export const IS_FAVOURITE = "isFavourite";

/** Ahead of whatever a list is sorted by — `true` sorts above `false`, so descending. */
export const FAVOURITES_FIRST: SortTerm = {
  attribute: IS_FAVOURITE,
  order: "desc",
};

/**
 * The same map qualified, which is what `onRef` takes. Derived so the two cannot disagree; an
 * inline template literal widens to `string` and Kysely refuses it.
 */
const FAVOURITE_REFERENCE = Object.fromEntries(
  FAVOURITE_TARGET_TYPES.map((kind) => [
    kind,
    `favourite.${FAVOURITE_COLUMN[kind]}`,
  ]),
) as {
  [Kind in FavouriteTargetType]: `favourite.${typeof FAVOURITE_COLUMN[Kind]}`;
};

/**
 * The reader's own favourite, as `isFavourite`. One place, because `.on("favourite.userId", …)` is
 * what scopes it: a copy that lost that line would report everybody's favourites as the reader's.
 */
export function withFavourite<TB extends keyof DB, Output>(
  queryBuilder: SelectQueryBuilder<DB, TB, Output>,
  kind: FavouriteTargetType,
  targetId: AnyColumnWithTable<DB, TB>,
  readerId: string,
) {
  // Kysely cannot resolve a reference against a table set it has not seen, so a helper generic over
  // the builder must assert them. The casts are the price of writing the join once.
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
 * `only` narrows a list to the reader's favourites. An enum rather than a boolean, like `status`
 * beside it, so a third case has somewhere to go.
 */
export type FavouriteFilter = "only" | "any";
