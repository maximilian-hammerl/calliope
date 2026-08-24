import { db } from "@/src/database/client.ts";
import type { User } from "@/src/service/user_service.ts";
import { resolveVisibleTarget } from "@/src/service/visible_target.ts";
import {
  FAVOURITE_COLUMN,
  type FavouriteTargetType,
} from "@/src/service/favourite_target.ts";

/**
 * One member marking one thing to come back to, across all five kinds that have one. The union and
 * the column map live in `favourite_target.ts`, which imports nothing that imports this.
 */

/** Every reference the unique index keys on, which is what `ON CONFLICT` has to name. */
const TARGET_COLUMNS = Object.values(FAVOURITE_COLUMN);

export type FavouriteRefusal = "not_found";

/**
 * **You can only favourite what you can see**, through the same resolver reporting uses: answering
 * differently for a thing that exists and a thing the member cannot see would turn favouriting
 * into a way of discovering private writing.
 *
 * Favouriting one's *own* group, idea or post is deliberately allowed, unlike reporting it and
 * unlike marking a story idea read. Both of those are about somebody else's thing by definition;
 * keeping your own group at the top of your own list is an ordinary thing to want.
 */
async function setFavourite(
  user: User,
  targetType: FavouriteTargetType,
  targetId: string,
): Promise<FavouriteRefusal | undefined> {
  const target = await resolveVisibleTarget(user, targetType, targetId);

  if (target === undefined) {
    return "not_found";
  }

  await db
    .insertInto("favourite")
    .values({ userId: user.id, [FAVOURITE_COLUMN[targetType]]: targetId })
    // Favouriting twice is the same as favouriting once, so a second click is not an error.
    // Unlike `report`'s, this index carries no predicate, so there is none to restate — the one
    // coupling that has broken that insert three times cannot exist here.
    .onConflict((conflict) =>
      conflict.columns(["userId", ...TARGET_COLUMNS]).doNothing()
    )
    .execute();

  return undefined;
}

/**
 * Deliberately asks no visibility question, where setting one does. A group that has gone private
 * since, or a chat the member has left, is exactly the favourite they most want rid of — and
 * refusing to remove it would leave them holding a row they cannot reach. Removing something that
 * was never there answers the same way, because absent is the state being asked for.
 */
async function clearFavourite(
  user: User,
  targetType: FavouriteTargetType,
  targetId: string,
): Promise<void> {
  await db
    .deleteFrom("favourite")
    .where("userId", "=", user.id)
    .where(FAVOURITE_COLUMN[targetType], "=", targetId)
    .execute();
}

export const FavouriteService = { setFavourite, clearFavourite };
