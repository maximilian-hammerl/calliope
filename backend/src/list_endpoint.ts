import { z } from "@hono/zod-openapi";

export const SORT_ORDER = z.enum(["asc", "desc"]);

export type SortOrder = z.infer<typeof SORT_ORDER>;

/**
 * Body schema shared by every list endpoint: paging, sorting and whatever filters the
 * endpoint adds. List endpoints use the QUERY method (RFC 10008), so this arrives as JSON
 * and the values are already typed — no coercion, and no empty-string edge cases.
 *
 * `sortAttribute` has to be an enum of the attributes the endpoint allows, mapped to the
 * column to order by. Restricting it here is what makes it safe to pass the value to
 * `dynamic.ref` later — an unchecked value there would be an injection.
 */
export function listQuerySchema<
  SortAttribute extends z.ZodType<string>,
  Filters extends z.ZodRawShape,
>(
  sortAttribute: SortAttribute,
  filters: Filters = {} as Filters,
  defaultSortOrder: SortOrder = "asc",
) {
  return z.object({
    limit: z.number().int().min(1).max(100).default(20),
    offset: z.number().int().min(0).default(0),
    sortAttribute,
    sortOrder: SORT_ORDER.default(defaultSortOrder),
    ...filters,
  });
}

/** Response schema shared by every list endpoint, so one page looks the same everywhere. */
export function listResponseSchema<Result extends z.ZodType>(result: Result) {
  return z.object({
    totalResults: z.number().int().nonnegative(),
    results: z.array(result),
  });
}
