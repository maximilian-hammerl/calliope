export function addShutdownSignalListener(
  listener: (signal: NodeJS.Signals) => void | Promise<void>,
  shutdownSignals: Array<NodeJS.Signals> = ["SIGINT", "SIGTERM", "SIGQUIT", "SIGHUP"],
): void {
  // Once, though a signal can arrive twice: `node --watch` forwards the one sent to its group.
  let shuttingDown = false;

  for (const signal of shutdownSignals) {
    process.on(signal, () => {
      if (shuttingDown) {
        return;
      }
      shuttingDown = true;

      // A step that fails is logged rather than left unhandled, so the others still run.
      Promise.resolve()
        .then(() => listener(signal))
        .catch((error: unknown) => {
          console.error(`A shutdown step failed on ${signal}:`, error);
        });
    });
  }
}
