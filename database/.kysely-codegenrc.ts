import { type Config, TypeScriptSerializer } from "kysely-codegen";
import { ZodSerializer } from "./kysely_zod_serializer.ts";

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

      return typeScriptTypes + zodSchemas;
    },
  },
};

export default config;
