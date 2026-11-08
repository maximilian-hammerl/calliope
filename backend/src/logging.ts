import {
  configure,
  getConsoleSink,
  getLogger,
  jsonLinesFormatter,
  type LogLevel,
  type LogRecord,
} from "@logtape/logtape";
import { ENVIRONMENT, type Environment } from "#/src/environment.ts";

/**
 * One logger for everything the server says, writing JSON lines in every environment, development
 * included, so what development shows is what production records.
 */

/** Everything logged outside a request. Inside one, prefer the logger the middleware provides. */
export const logger = getLogger(["calliope"]);

/**
 * `testing` is deployed and polls `/api/health`, so it stops short of the `trace` that heartbeat
 * uses. A `Record`, so a new environment is a compile error rather than the quietest level.
 */
const LEVEL: Record<Environment, LogLevel> = {
  development: "trace",
  testing: "debug",
  staging: "info",
  production: "info",
};

/** Call once, before the server starts. Nothing is emitted until it has, so tests stay silent. */
export function configureLogging(): Promise<void> {
  return configure({
    sinks: { console: getConsoleSink({ formatter: formatLogLine }) },
    loggers: [
      {
        category: "calliope",
        lowestLevel: LEVEL[ENVIRONMENT],
        sinks: ["console"],
      },
      // At `info` this prints a paragraph about itself at every boot.
      {
        category: ["logtape", "meta"],
        lowestLevel: "warning",
        sinks: ["console"],
      },
    ],
  });
}

type LoggedError = {
  name: string;
  message: string;
  stack?: string;
  code?: string | number;
  cause?: LoggedError | string;
};

/** Exported for its test. Every `Error` in a record is spelled out by `spellOutError`. */
export function formatLogLine(record: LogRecord): string {
  const properties = Object.fromEntries(
    Object.entries(record.properties).map(([key, value]) => [key, loggable(key, value)]),
  );
  const message = record.message.map((part) =>
    part instanceof Error ? spellOutError(part) : part,
  );

  return jsonLinesFormatter({ ...record, message, properties });
}

function loggable(key: string, value: unknown): unknown {
  if (value instanceof Error) {
    return spellOutError(value);
  }
  // Something thrown that is not an `Error`: `undefined` would otherwise drop out of the line.
  if (key === "error") {
    return { message: String(value) };
  }
  return value;
}

/**
 * These fields and no others: drivers keep member data in fields of their own (a unique
 * violation's `detail` names the address, Kysely's `NoResultError` carries the query's values).
 */
function spellOutError(error: Error, depth = 0): LoggedError {
  const logged: LoggedError = { name: error.name, message: error.message, stack: error.stack };

  const code = "code" in error ? error.code : undefined;
  if (typeof code === "string" || typeof code === "number") {
    logged.code = code;
  }

  if (error.cause instanceof Error) {
    // Bounded, since nothing stops a cause from pointing back at its error.
    logged.cause = depth < 4 ? spellOutError(error.cause, depth + 1) : error.cause.message;
  } else if (error.cause !== undefined) {
    // Not an `Error`, so nothing says which of its fields are safe to write.
    logged.cause = typeof error.cause;
  }

  return logged;
}
