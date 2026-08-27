import { type Config, TypeScriptSerializer } from "kysely-codegen";
import { ZodSerializer } from "./kysely_zod_serializer.ts";

const DATABASE_URL = Deno.env.get("DATABASE_URL");

if (!DATABASE_URL) {
  throw new Error("Missing DATABASE_URL, cannot generate types");
}

/**
 * Columns whose database type does not map to a schema on its own. Each entry gives the
 * TypeScript type and the zod schema for one column.
 */
const columnOverrides: Record<string, { typeScript: string; zod: string }> = {};

const config: Config = {
  camelCase: true,
  dialect: "postgres",
  includePattern: "public.*",
  numericParser: "number",
  outFile: "../backend/src/database/schema.ts",
  typeMapping: {
    // Kysely's own `Json` is a recursive union, and a recursive type in a route's response sends
    // `@hono/zod-openapi`'s generics into TS2589, an error naming neither the column nor the
    // route. `unknown` forces the reader to say what is in there, which a schema does anyway.
    json: "unknown",
    jsonb: "unknown",
    timestamp: "string",
    timestamptz: "string",
    date: "string",
    time: "string",
    interval: "string",
    numeric: "number",
  },
  url: Deno.env.get("DATABASE_URL"),
  // The TypeScript types and the zod schemas are generated from the same introspection,
  // so they cannot drift from each other or from the database.
  serializer: {
    serializeFile: (metadata, dialect, options) => {
      const typeScriptTypes = new TypeScriptSerializer().serializeFile(
        metadata,
        dialect,
        {
          ...options,
          overrides: {
            ...options?.overrides,
            columns: Object.fromEntries(
              Object.entries(columnOverrides).map((
                [column, { typeScript }],
              ) => [column, typeScript]),
            ),
          },
        },
      );

      const zodSchemas = new ZodSerializer().serializeFile(metadata, dialect, {
        ...options,
        overrides: {
          ...options?.overrides,
          columns: Object.fromEntries(
            Object.entries(columnOverrides).map(([column, { zod }]) => [
              column,
              zod,
            ]),
          ),
        },
      });

      const generated = typeScriptTypes + zodSchemas;

      // `bytea` maps to Buffer, which is a Node global rather than a Deno one - emitted here
      // because a hand-added import would be wiped by the next generation. Conditional, so a
      // schema without a bytea column does not get an unused import.
      return generated.includes("Buffer")
        ? 'import { Buffer } from "node:buffer";\n\n' + generated
        : generated;
    },
  },
};

export default config;
