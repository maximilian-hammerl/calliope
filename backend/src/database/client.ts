import {
  CamelCasePlugin,
  Kysely,
  type Transaction as KyselyTransaction,
} from "kysely";
import { PostgresJSDialect } from "kysely-postgres-js";
import postgres from "postgres";
import { DB } from "./schema.ts";
import { postgresTypes } from "./postgres_types.ts";
import { getRequiredEnvVariable } from "@/src/util/env.ts";
import { addShutdownSignalListener } from "@/src/util/shutdown_signal.ts";
import {
  type DatabaseHealth,
  probeDatabase,
} from "@/src/operations/database_health.ts";

export type Database = Kysely<DB>;
export type Transaction = KyselyTransaction<DB>;

const driver = postgres(getRequiredEnvVariable("DATABASE_URL"), {
  ssl: false,
  connection: {
    // Every query here is milliseconds' work; this only stops a runaway holding a pool slot.
    statement_timeout: 30 * 1000, // PostgreSQL expects milliseconds
  },
  // Around (cores × 2) for the six-core host, which shares them with the app, Caddy and Redis.
  max: 10,
  // Lets the pool shrink back when traffic stops, instead of holding connections open for ever.
  idle_timeout: 30,
  // Recycles connections, so none lives long enough to go stale on the network beneath it.
  max_lifetime: 60 * 30,
  types: postgresTypes,
});

export async function closeDatabaseConnections(): Promise<void> {
  console.log("Closing database connection before shutdown");
  // 5 seconds is the recommended value by the library
  await driver.end({ timeout: 5 });
  console.log("Successfully closed database connection");
}

addShutdownSignalListener(closeDatabaseConnections);

const dialect = new PostgresJSDialect({
  postgres: driver,
});

export const db = new Kysely<DB>({
  dialect,
  plugins: [new CamelCasePlugin()],
});

export function databaseHealthCheck(): Promise<DatabaseHealth> {
  return probeDatabase("postgres", true, () => driver`SELECT true;`);
}
