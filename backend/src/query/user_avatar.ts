import type { AnyColumnWithTable, SelectQueryBuilder } from "kysely";
import type { DB } from "@/src/database/schema.ts";

/**
 * Written once, like `withFavourite`: five queries select a person, and a join spread over five of
 * them is five chances to forget one. The URL a client is given is `http/avatar_url.ts`.
 */
export const AVATAR_FILE_ID = "avatarFileId" as const;

export function withAvatar<TB extends keyof DB, Output>(
  queryBuilder: SelectQueryBuilder<DB, TB, Output>,
  userId: AnyColumnWithTable<DB, TB>,
) {
  // Kysely cannot resolve a reference against a table set it has not seen yet, so a helper generic
  // over the builder has to assert them — the price of writing the join once.
  return queryBuilder
    .leftJoin(
      "userAvatar",
      (join) => join.onRef("userAvatar.userId" as never, "=", userId as never),
    )
    .select((eb) =>
      eb.ref("userAvatar.fileId" as never).$castTo<string | null>().as(
        AVATAR_FILE_ID,
      )
    );
}
