import type { SelectQueryBuilder } from "kysely";
import { db } from "@/src/database/client.ts";
import type { DB } from "@/src/database/schema.ts";
import type { SortOrder } from "./list_endpoint.ts";

export type ListQuery = {
  limit: number;
  offset: number;
  sort: Array<{
    attribute: string;
    order: SortOrder;
  }>;
  search?: string;
};

/**
 * Wraps a search term for a case-insensitive `like`, escaping the wildcards first: `%` and
 * `_` are meaningful to LIKE, so a member searching for "100%" or "a_b" would otherwise get
 * matches that have nothing to do with what they typed.
 *
 * The pattern is a substring match on purpose — someone looking for a person often knows the
 * middle of a name rather than its start.
 */
export function searchPattern(search: string): string {
  return `%${search.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
}

export type ListResults<Result> = {
  results: Array<Result>;
  totalResults: number;
};

/** One term of a list's ordering. `attribute` names an output alias, which `dynamic.ref` reaches. */
export type SortTerm = { attribute: string; order: SortOrder };

/**
 * The wire carries one attribute and one order, because nothing has asked to sort by two things;
 * `ListQuery` carries the list a query is actually built from. Routes hand the validated body
 * through here, which is the one place the two shapes meet.
 */
export function listQuery<
  Body extends { sortAttribute: string; sortOrder: SortOrder },
>(
  body: Body,
): Omit<Body, "sortAttribute" | "sortOrder"> & { sort: SortTerm[] } {
  const { sortAttribute, sortOrder, ...rest } = body;
  return { ...rest, sort: [{ attribute: sortAttribute, order: sortOrder }] };
}

/**
 * Last term of every list, so a page boundary cannot fall inside a group of rows the sort cannot
 * separate — two pages of a list ordered on a repeated value would otherwise show one row twice and
 * another not at all. `id` is an output column of every list, and unique, so it always separates.
 */
const TIEBREAK: SortTerm = { attribute: "id", order: "asc" };

/**
 * Runs a page and its total against the same query builder, so the two can never disagree
 * about which rows they are describing.
 *
 * The total counts the rows of the query itself rather than the rows it reads, so a query
 * that groups or de-duplicates is counted as the caller sees it. Paging and ordering are
 * applied to the page only; the builder handed in must not carry either.
 *
 * `sortBefore` is what an endpoint puts ahead of the member's own choice — favourites first, and
 * nothing else so far. It never comes from a request, which is what keeps it out of
 * `dynamic.ref`'s injection surface; the request's own attribute is an enum for the same reason.
 */
export async function listResultsWithCount<TB extends keyof DB, Result>(
  queryBuilder: SelectQueryBuilder<DB, TB, Result>,
  query: ListQuery,
  ...sortBefore: SortTerm[]
): Promise<ListResults<Result>> {
  const sort: SortTerm[] = [...sortBefore, ...query.sort, TIEBREAK];

  const page = sort.reduce(
    (builder, term) =>
      builder.orderBy(
        db.dynamic.ref(term.attribute),
        (orderBy) =>
          term.order === "asc"
            ? orderBy.asc().nullsLast()
            : orderBy.desc().nullsLast(),
      ),
    queryBuilder,
  );

  const [results, { count }] = await Promise.all([
    page.limit(query.limit).offset(query.offset).execute(),
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
