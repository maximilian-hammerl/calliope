import { TypeOverrides, types } from "pg";

/**
 * The column types the generated schema reads differently from pg's defaults: `int8` and
 * `numeric` as numbers, and timestamps as ISO 8601 strings rather than a `Date`, which would drop
 * the microseconds.
 */
export const postgresTypes = new TypeOverrides();

postgresTypes.setTypeParser(types.builtins.INT8, Number);
postgresTypes.setTypeParser(types.builtins.NUMERIC, Number);

// "2025-05-20 08:43:17.025289" becomes "2025-05-20T08:43:17.025289".
postgresTypes.setTypeParser(types.builtins.TIMESTAMP, (value: string) => value.replace(" ", "T"));

// "2025-05-20 08:43:17.025289+00" becomes "2025-05-20T08:43:17.025289+00:00".
postgresTypes.setTypeParser(
  types.builtins.TIMESTAMPTZ,
  (value: string) => `${value.replace(" ", "T")}:00`,
);

// The parser of `text[]` (1009), which reads an enum array's labels as well as it reads text. pg's
// typings name only scalar types, hence the cast.
// oxlint-disable-next-line typescript/no-unsafe-enum-assignment -- 1009 is a real type id
const parseTextArray = types.getTypeParser(1009 as Parameters<typeof types.getTypeParser>[0]);

/**
 * An enum array's type id is assigned when its migration runs, so pg cannot know it in advance
 * and would hand `{fantasy,mystery}` back as one string. `client.ts` reads the ids per connection.
 */
export function registerEnumArrays(typeIds: Array<number>): void {
  for (const typeId of typeIds) {
    postgresTypes.setTypeParser(typeId, parseTextArray);
  }
}
