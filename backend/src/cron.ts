import { Cron } from "croner";
import { db } from "./database/client.ts";
import { UserAvatarService } from "./service/user_avatar_service.ts";
import { UserTokenService } from "./service/user_token_service.ts";
import { UserService } from "./service/user_service.ts";
import { getAbortSignalForShutdown } from "./util/abort_signal.ts";
import { logger } from "#/src/logging.ts";

/**
 * In UTC whatever the host's zone, and a run that outlasts its interval is not started twice. A
 * failed run is logged: without `catch`, croner leaves it unhandled and Node exits.
 */
const OPTIONS = {
  timezone: "Etc/UTC",
  protect: true,
  catch: (error: unknown, job: Cron) => {
    logger.error("Cron job failed", { job: job.name, error });
  },
};

export function scheduleCronJobs() {
  const jobs = [
    new Cron("0 * * * *", { ...OPTIONS, name: "Delete expired sessions" }, async () => {
      const deletedSessions = await db
        .transaction()
        .execute((transaction) => UserService.deleteExpiredSessions(transaction));
      logger.info("Deleted expired sessions", { count: deletedSessions });
    }),

    // Daily rather than hourly: nothing is waiting on it, and what it deletes has been unreferenced
    // for longer than the backups are kept.
    new Cron("15 4 * * *", { ...OPTIONS, name: "Delete unreferenced files" }, async () => {
      const deletedFiles = await UserAvatarService.sweepUnreferencedFiles();
      logger.info("Deleted unreferenced files", { count: deletedFiles });
    }),

    new Cron("30 * * * *", { ...OPTIONS, name: "Delete expired user tokens" }, async () => {
      const deletedTokens = await db
        .transaction()
        .execute((transaction) => UserTokenService.deleteExpiredTokens(transaction));
      logger.info("Deleted expired user tokens", { count: deletedTokens });
    }),
  ];

  getAbortSignalForShutdown().addEventListener(
    "abort",
    () => {
      for (const job of jobs) {
        job.stop();
      }
    },
    { once: true },
  );
}
