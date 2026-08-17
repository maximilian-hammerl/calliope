import { getRequiredEnvVariable } from "./util/env.ts";

export default {
  origin: [getRequiredEnvVariable("HOST_URL")],
  allowHeaders: [
    "origin",
    "content-type",
    "authorization",
  ],
  // QUERY (RFC 10008) is used by the list endpoints.
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "QUERY"],
  credentials: true,
};
