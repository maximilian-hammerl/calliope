import { getOptionalEnvVariable } from "@/src/util/env.ts";

export const APP_NAME = getOptionalEnvVariable("APP_NAME") ?? "Calliope";

export const APP_DESCRIPTION = getOptionalEnvVariable("APP_DESCRIPTION") ??
  `The API of ${APP_NAME}, a community of private writing groups.`;

export const APP_CONTACT = (() => {
  const name = getOptionalEnvVariable("APP_CONTACT_NAME");
  const email = getOptionalEnvVariable("APP_CONTACT_EMAIL");

  if (name === undefined && email === undefined) {
    return undefined;
  }

  return {
    ...(name === undefined ? {} : { name }),
    ...(email === undefined ? {} : { email }),
  };
})();
