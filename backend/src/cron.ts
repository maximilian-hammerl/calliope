import { UserTokenService } from "./service/user_token_service.ts";
import { UserService } from "./service/user_service.ts";
import { getAbortSignalForShutdown } from "./util/abort_signal.ts";

export function scheduleCronJobs() {
  Deno.cron(
    "Delete expired sessions",
    "0 * * * *",
    { signal: getAbortSignalForShutdown() },
    async () => {
      const deletedSessions = await UserService.deleteExpiredSessions();
      console.log(`Deleted ${deletedSessions} expired session(s)`);
    },
  );

  Deno.cron(
    "Delete expired user tokens",
    "30 * * * *",
    { signal: getAbortSignalForShutdown() },
    async () => {
      const deletedTokens = await UserTokenService.deleteExpiredTokens();
      console.log(`Deleted ${deletedTokens} expired user token(s)`);
    },
  );
}
