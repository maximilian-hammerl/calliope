import { UserService } from "./service/user_service.ts";
import { getAbortSignalForShutdown } from "./util/abort_signal.ts";

/**
 * Registered from main.ts rather than app.ts, so importing the app in tests does not
 * schedule background work. The shutdown signal deregisters the job, which also lets
 * the process exit instead of being kept alive by the cron scheduler.
 */
Deno.cron(
  "Delete expired sessions",
  "0 * * * *",
  { signal: getAbortSignalForShutdown() },
  async () => {
    const deletedSessions = await UserService.deleteExpiredSessions();
    console.log(`Deleted ${deletedSessions} expired session(s)`);
  },
);
