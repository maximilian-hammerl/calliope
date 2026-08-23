import { z } from "@hono/zod-openapi";
import { deadline } from "@std/async/deadline";

// https://datatracker.ietf.org/doc/html/draft-inadarei-api-health-check
// https://github.com/healthjson/schema
// https://raw.githubusercontent.com/health-json/schema/master/schema.json

export const APPLICATION_HEALTH_STATUS = z
  .object({
    name: z
      .string()
      .min(1)
      .describe(
        "Organization-wide unique name for identifying the application",
      ),
    datetime: z
      .iso
      .datetime({ offset: true })
      .describe("The application's current date and time incl. timezone"),
    startup: z
      .iso
      .datetime({ offset: true })
      .describe("The date and time of when the application instance started"),
    uptime: z
      .iso
      .duration()
      .describe("The duration how long the application instance is running"),
    hostname: z
      .string()
      .describe("Name of the host which is running the application instance"),
    version: z
      .string()
      .describe("Current application version")
      .optional(),
    releaseId: z
      .string()
      .describe(
        "The build running behind that version — the deployed commit. Absent when the deploy did not stamp one.",
      )
      .optional(),
  })
  .describe("General information about application and current version");

export const DATABASE_HEALTH_STATUS = z
  .object({
    name: z
      .string()
      .min(1)
      .describe("Unique name/identifier of the database system"),
    essential: z
      .boolean()
      .describe("Database is essential for overall application health"),
    health: z
      .boolean()
      .describe("Connection established without any limitations"),
    latency: z
      .number()
      .describe("Latency or duration for full roundtrip in milliseconds"),
    connections: z
      .number()
      .int()
      .describe("Number of connections established")
      .optional(),
    error: z
      .string()
      .describe("Connectivity error occured, if any")
      .optional(),
  })
  .describe("Detailed health information about a connected database");

export const HEALTH_RESPONSE = z
  .object({
    application: APPLICATION_HEALTH_STATUS,
    health: z
      .object({
        databases: z.boolean().optional(),
      })
      .describe("Global health status aggregated by groups"),
    databases: z
      .array(DATABASE_HEALTH_STATUS)
      .min(1)
      .describe("Detailed health information about all connected databases")
      .optional(),
  })
  .describe("Schema for media type application/health+json");

export type DatabaseHealth = z.infer<typeof DATABASE_HEALTH_STATUS>;

/** A probe must never hang, or the health endpoint hangs with it. */
const PROBE_TIMEOUT = Temporal.Duration.from({ seconds: 2 });

/**
 * Times a probe and turns any failure into a report rather than an exception, so one
 * unreachable database cannot stop the health endpoint from answering.
 */
export async function probeDatabase(
  name: string,
  essential: boolean,
  probe: () => Promise<unknown>,
): Promise<DatabaseHealth> {
  const start = performance.now();

  try {
    await deadline(probe(), PROBE_TIMEOUT.total("milliseconds"));

    return {
      name,
      essential,
      health: true,
      latency: performance.now() - start,
    };
  } catch (error) {
    console.error(`Health check for ${name} failed`, error);

    return {
      name,
      essential,
      health: false,
      latency: performance.now() - start,
      // The endpoint is unauthenticated, so the real cause stays in the log.
      error: "Connection failed",
    };
  }
}
