export function addShutdownSignalListener(
  listener: (signal: Deno.Signal) => void,
  shutdownSignals: Array<Deno.Signal> = [
    "SIGINT",
    "SIGTERM",
    "SIGQUIT",
    "SIGHUP",
  ],
): void {
  for (const signal of shutdownSignals) {
    Deno.addSignalListener(signal, () => {
      listener(signal);
    });
  }
}
