import type { Favourite } from "@/src/database/schema.ts";

/**
 * What a favourite can name, and where each kind's id goes. A leaf module on purpose: the five
 * services that join `favourite` need these constants, and `favourite_service` reaches
 * `visible_target`, which reaches back into those services. Importing the constants from there
 * closed that circle, and TypeScript answers a circular import with `any` — which showed up as a
 * join column silently typed as anything at all rather than as an error.
 *
 * **The kind is request vocabulary, not a stored fact.** `favourite` carries no `target_type`
 * column: its references cascade, so exactly one is set for the row's whole life and each column
 * means one thing, which makes the kind readable off the data. What the API needs a name for is
 * *which column to write* — see the migration for why the table differs from `report` and
 * `notification` here.
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

/**
 * `only` narrows a list to the reader's own favourites. An enum rather than a boolean, matching
 * `status` and `readerState` beside it: a list that grows a third case then has somewhere to put
 * it without changing shape.
 */
export type FavouriteFilter = "only" | "any";
