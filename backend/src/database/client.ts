import {
  CamelCasePlugin,
  CompiledQuery,
  Kysely,
  PostgresDialect,
  type Transaction as KyselyTransaction,
} from "kysely";
import { Pool } from "pg";
import type { DB } from "./schema.ts";
import { postgresTypes, registerEnumArrays } from "./postgres_types.ts";
import { getRequiredEnvVariable } from "#/src/util/env.ts";
import { addShutdownSignalListener } from "#/src/util/shutdown_signal.ts";
import { logger } from "#/src/logging.ts";
import { type DatabaseHealth, probeDatabase } from "#/src/operations/database_health.ts";

export type Transaction = KyselyTransaction<DB>;

const pool = new Pool({
  connectionString: getRequiredEnvVariable("DATABASE_URL"),
  // Every query here is milliseconds' work; this only stops a runaway holding a pool slot.
  statement_timeout: 30 * 1000,
  // Around (cores × 2) for the six-core host, which shares them with the app, Caddy and Redis.
  max: 10,
  // Lets the pool shrink back when traffic stops, instead of holding connections open for ever.
  idleTimeoutMillis: 30 * 1000,
  // Recycles connections, so none lives long enough to go stale on the network beneath it.
  maxLifetimeSeconds: 60 * 30,
  types: postgresTypes,
});

// Without a listener, an idle connection that fails (the database restarting) is an unhandled
// `error` event and takes the process down.
pool.on("error", (error) => {
  logger.error("Idle database connection failed", { error });
});

async function closeDatabaseConnections(): Promise<void> {
  logger.info("Closing database connection before shutdown");
  await pool.end();
  logger.info("Successfully closed database connection");
}

addShutdownSignalListener(closeDatabaseConnections);

const dialect = new PostgresDialect({
  pool,
  // Per connection rather than once, so a database rebuilt under a running server is read again.
  onCreateConnection: async (connection) => {
    const { rows } = await connection.executeQuery<{ typarray: number }>(
      CompiledQuery.raw("SELECT typarray FROM pg_catalog.pg_type WHERE typtype = 'e';"),
    );
    registerEnumArrays(rows.map((row) => row.typarray));
  },
});

/**
 * Reads and transactions, and deliberately not writes: `insertInto`, `updateTable` and
 * `deleteFrom` are not on this handle, so a write has to open a transaction and the compiler is
 * what says so. Forgetting one used to be a convention to remember — and a route composing two
 * service calls got two transactions, which is how an account could be written without its
 * session. A write service function therefore takes the `Transaction` from its caller; an entry
 * point (a route, `cron.ts`, a background task, the seed, a test) is what opens it.
 */
export const db: Omit<
  Kysely<DB>,
  "insertInto" | "updateTable" | "deleteFrom" | "replaceInto" | "mergeInto"
> = new Kysely<DB>({
  dialect,
  plugins: [new CamelCasePlugin()],
});

export function databaseHealthCheck(): Promise<DatabaseHealth> {
  return probeDatabase("postgres", true, () => pool.query("SELECT true;"));
}
