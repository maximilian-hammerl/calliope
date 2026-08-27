import app from "@/src/app.ts";
import { configureLogging } from "@/src/logging.ts";
import { scheduleCronJobs } from "@/src/cron.ts";
import { getAbortSignalForShutdown } from "@/src/util/abort_signal.ts";
import { runHealthCheck } from "@/health_check.ts";
import { seedDatabase } from "@/seed.ts";
import { getOptionalEnvVariable } from "@/src/util/env.ts";
import { grantRole, revokeRole } from "@/grant_role.ts";

if (import.meta.main) {
  await configureLogging();

  // Not from the environment: Docker sets HOSTNAME to the container id, and binding to
  // that leaves 127.0.0.1 unanswered.
  const HOSTNAME = "0.0.0.0";

  // Defaulted, because the healthcheck and Caddy expect 8000.
  const PORT = Number(getOptionalEnvVariable("BACKEND_PORT") ?? 8000);

  // The image is distroless, so the health check has nothing else to run. Exits before the
  // cron jobs below are scheduled.
  if (Deno.args.includes("--health-check")) {
    await runHealthCheck(PORT);
  }

  if (Deno.args.includes("--seed")) {
    await seedDatabase();
  }

  // Both exit when done, like the seed above: these are commands the image can run, not
  // options that change how the server behaves.
  if (Deno.args.includes("--grant-role")) {
    await grantRole();
  }

  if (Deno.args.includes("--revoke-role")) {
    await revokeRole();
  }

  scheduleCronJobs();

  Deno.serve({
    hostname: HOSTNAME,
    port: PORT,
    signal: getAbortSignalForShutdown(),
  }, app.fetch);
}
