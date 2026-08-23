import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { STATUS_CODE } from "@std/http/status";
import { APP_NAME } from "@/src/branding.ts";
import { API_VERSION, OPERATIONS_TAG } from "@/src/open_api_specification.ts";
import {
  getOptionalEnvVariable,
  getRequiredEnvVariable,
} from "@/src/util/env.ts";
import { databaseHealthCheck } from "@/src/database/client.ts";
import { redisHealthCheck } from "@/src/redis/client.ts";
import { COMMON_RESPONSES, jsonContent } from "@/src/http/response.ts";
import { HEALTH_RESPONSE } from "@/src/operations/database_health.ts";

const startup = Temporal.Now.zonedDateTimeISO();

// Resolved once, so a bad HOST_URL fails at startup rather than on every request.
const hostname = new URL(getRequiredEnvVariable("HOST_URL")).hostname;

// Stamped by deploy.sh, so a deploy can prove the code it just pushed is the code answering.
// Optional: nothing stamps it when the backend is run by hand.
const releaseId = getOptionalEnvVariable("GIT_COMMIT");

async function response() {
  const now = Temporal.Now.zonedDateTimeISO();

  // Probed together, so one slow database does not add to the other's latency.
  const databases = await Promise.all([
    databaseHealthCheck(),
    redisHealthCheck(),
  ]);

  return {
    application: {
      name: APP_NAME,
      datetime: now.toString({ timeZoneName: "never" }),
      startup: startup.toString({ timeZoneName: "never" }),
      uptime: startup.until(now).toString(),
      hostname,
      version: API_VERSION,
      releaseId,
    },
    health: {
      // A non-essential database being down does not make the application unhealthy.
      databases: databases.every((database) =>
        !database.essential || database.health
      ),
    },
    databases,
  };
}

export default new OpenAPIHono().openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: [OPERATIONS_TAG],
    summary: "Report whether the application and its databases are usable",
    description:
      "Reports the application's identity and uptime together with the reachability of every database it depends on. Answers without a session and is not rate limited, so it can be polled by a liveness probe.",
    operationId: "getHealth",
    responses: {
      [STATUS_CODE.OK]: {
        description: "Everything the application depends on is reachable",
        content: jsonContent(HEALTH_RESPONSE),
      },
      [STATUS_CODE.ServiceUnavailable]: {
        description: "A database is unreachable",
        content: jsonContent(HEALTH_RESPONSE),
      },
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const body = await response();

    // The body carries the detail, but probes and load balancers only read the status.
    return c.json(
      body,
      body.health.databases ? STATUS_CODE.OK : STATUS_CODE.ServiceUnavailable,
    );
  },
);
