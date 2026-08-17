import type { SelectQueryBuilder } from "kysely";
import { db } from "./database/client.ts";
import type { DB } from "./database/schema.ts";
import type { SortOrder } from "./list_endpoint.ts";

export type ListQuery = {
  limit: number;
  offset: number;
  sortAttribute: string;
  sortOrder: SortOrder;
};

export type ListResults<Result> = {
  results: Array<Result>;
  totalResults: number;
};

/**
 * Runs a page and its total against the same query builder, so the two can never disagree
 * about which rows they are describing.
 *
 * The total counts the rows of the query itself rather than the rows it reads, so a query
 * that groups or de-duplicates is counted as the caller sees it. Paging and ordering are
 * applied to the page only; the builder handed in must not carry either.
 */
export async function listResultsWithCount<TB extends keyof DB, Result>(
  queryBuilder: SelectQueryBuilder<DB, TB, Result>,
  query: ListQuery,
): Promise<ListResults<Result>> {
  const [results, { count }] = await Promise.all([
    queryBuilder
      .orderBy(
        db.dynamic.ref(query.sortAttribute),
        (orderBy) =>
          query.sortOrder === "asc"
            ? orderBy.asc().nullsLast()
            : orderBy.desc().nullsLast(),
      )
      .limit(query.limit)
      .offset(query.offset)
      .execute(),
    db
      // Ordering and paging would only make the count more expensive or wrong.
      .selectFrom(
        queryBuilder.clearOrderBy().clearLimit().clearOffset().as("results"),
      )
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .executeTakeFirstOrThrow(),
  ]);

  return { results, totalResults: Number(count) };
}
