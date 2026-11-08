import { addShutdownSignalListener } from "./shutdown_signal.ts";
import { logger } from "#/src/logging.ts";

const controller = new AbortController();

export function getAbortSignalForShutdown(): AbortSignal {
  return controller.signal;
}

addShutdownSignalListener((signal) => {
  logger.info("Received a shutdown signal, aborting", { signal });
  controller.abort(signal);
});
