import type postgres from "postgres";

const int8: postgres.PostgresType<number> = {
  to: 20,
  from: [20],
  parse: (x: string) => Number(x),
  serialize: (x: number) => String(x),
};

const numeric: postgres.PostgresType<number> = {
  to: 1700,
  from: [1700],
  parse: (value: string) => Number(value),
  serialize: (value: number) => String(value),
};

/**
 * Converts a PostgreSQL timestamp to ISO 8601 format.
 * @param timestamp - PostgreSQL timestamp (e.g., "2025-05-20 08:43:17.025289")
 * @returns ISO 8601 formatted string (e.g., "2025-05-20T08:43:17.025289")
 */
function parsePostgresTimestampToIsoString(timestamp: string): string {
  return timestamp.replace(" ", "T");
}

const timestamp = {
  to: 1114,
  from: [1114],
  parse: (value: string) => parsePostgresTimestampToIsoString(value),
  serialize: (value: string) => value,
};

/**
 * Converts a PostgreSQL timestamptz to ISO 8601 format.
 * @param timestamp - PostgreSQL timestamp (e.g., "2025-05-20 08:43:17.025289+00")
 * @returns ISO 8601 formatted string (e.g., "2025-05-20T08:43:17.025289+00:00")
 */
function parsePostgresTimestamptzToIsoString(timestamp: string): string {
  return timestamp.replace(" ", "T") + ":00";
}

const timestamptz = {
  to: 1184,
  from: [1184],
  parse: (value: string) => parsePostgresTimestamptzToIsoString(value),
  serialize: (value: string) => value,
};

export const postgresTypes = {
  int8,
  numeric,
  timestamp,
  timestamptz,
};
