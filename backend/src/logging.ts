import {
  configure,
  getConsoleSink,
  getLogger,
  jsonLinesFormatter,
  type LogLevel,
} from "@logtape/logtape";
import { ENVIRONMENT, type Environment } from "@/src/environment.ts";

/**
 * One logger for the backend. JSON lines everywhere, including development: an `Error` does not
 * survive `JSON.stringify`, so a formatter that differed would hide what this exists to record.
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
    sinks: { console: getConsoleSink({ formatter: jsonLinesFormatter }) },
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

/** Spelled out field by field, because `JSON.stringify(new Error("boom"))` is `{}`. */
export function describeError(error: unknown): {
  error: { name?: string; message: string; stack?: string };
} {
  if (!(error instanceof Error)) {
    return { error: { message: String(error) } };
  }

  return {
    error: { name: error.name, message: error.message, stack: error.stack },
  };
}
