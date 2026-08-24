import {
  configure,
  getConsoleSink,
  getLogger,
  jsonLinesFormatter,
} from "@logtape/logtape";
import { ENVIRONMENT, type Environment } from "@/src/environment.ts";

/**
 * One logger for the backend, configured once at startup. App-wide configuration, so it sits at
 * `src/`'s root beside `cors_options.ts` rather than in a directory of its own.
 *
 * **JSON lines everywhere, including development.** An `Error` does not survive `JSON.stringify` —
 * it comes out as `{}` — so a formatter that differs between here and production would hide
 * exactly the failure this exists to record. Read it locally with `jq`, or swap the formatter for
 * `ansiColorFormatter` while working on something noisy.
 */

/** Everything logged outside a request. Inside one, prefer the logger the middleware provides. */
export const logger = getLogger(["calliope"]);

/** Where `debug` is worth its volume. Adding an environment is then a decision, not a default. */
const VERBOSE: readonly Environment[] = ["development", "testing"];

/**
 * Call once, before the server starts. Nothing is emitted until it has, which is also why the test
 * suite is silent — it never calls this.
 */
export function configureLogging(): Promise<void> {
  return configure({
    sinks: { console: getConsoleSink({ formatter: jsonLinesFormatter }) },
    loggers: [
      {
        category: "calliope",
        lowestLevel: VERBOSE.includes(ENVIRONMENT) ? "debug" : "info",
        sinks: ["console"],
      },
      // LogTape's own diagnostics. At `info` it prints a paragraph about itself at every boot; a
      // warning here means logging itself is failing, which is worth seeing.
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
