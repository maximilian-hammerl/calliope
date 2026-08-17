import { addShutdownSignalListener } from "./shutdown_signal.ts";

const controller = new AbortController();

export function getAbortSignalForShutdown(): AbortSignal {
  return controller.signal;
}

addShutdownSignalListener((signal) => {
  console.log(`Received ${signal}, aborting`);
  controller.abort(signal);
});
