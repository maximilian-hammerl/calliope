import app from "@/src/app.ts";
import { scheduleCronJobs } from "@/src/cron.ts";
import { getAbortSignalForShutdown } from "@/src/util/abort_signal.ts";
import { runHealthCheck } from "@/health_check.ts";
import { seedDatabase } from "@/seed.ts";

if (import.meta.main) {
  // Not from the environment: Docker sets HOSTNAME to the container id, and binding to
  // that leaves 127.0.0.1 unanswered.
  const HOSTNAME = "0.0.0.0";
  const PORT = 8000;

  // The image is distroless, so the health check has nothing else to run. Exits before the
  // cron jobs below are scheduled.
  if (Deno.args.includes("--health-check")) {
    await runHealthCheck(PORT);
  }

  if (Deno.args.includes("--seed")) {
    await seedDatabase();
  }

  scheduleCronJobs();

  Deno.serve({
    hostname: HOSTNAME,
    port: PORT,
    signal: getAbortSignalForShutdown(),
  }, app.fetch);
}
