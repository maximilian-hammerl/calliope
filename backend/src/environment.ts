import * as z from "zod";
import { getRequiredEnvVariable } from "@/src/util/env.ts";

export const ENVIRONMENTS = [
  "development",
  "testing",
  "staging",
  "production",
] as const;

export const ENVIRONMENT_SCHEMA = z.enum(ENVIRONMENTS);

export type Environment = z.infer<typeof ENVIRONMENT_SCHEMA>;

function readEnvironment(): Environment {
  const value = getRequiredEnvVariable("ENVIRONMENT");
  const parsed = ENVIRONMENT_SCHEMA.safeParse(value);

  if (!parsed.success) {
    throw new Error(
      `ENVIRONMENT must be one of ${ENVIRONMENTS.join(", ")}, not "${value}"`,
    );
  }

  return parsed.data;
}

export const ENVIRONMENT: Environment = readEnvironment();
