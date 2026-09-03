import { getOptionalEnvVariable } from "@/src/util/env.ts";

export const APP_NAME = getOptionalEnvVariable("APP_NAME") ?? "Calliope";

export const APP_DESCRIPTION = getOptionalEnvVariable("APP_DESCRIPTION") ??
  `The API of ${APP_NAME}, a community of private writing groups.`;

export const APP_CONTACT = (() => {
  const name = getOptionalEnvVariable("APP_CONTACT_NAME");
  const emailAddress = getOptionalEnvVariable("APP_CONTACT_EMAIL_ADDRESS");

  if (name === undefined && emailAddress === undefined) {
    return undefined;
  }

  return {
    ...(name === undefined ? {} : { name }),
    // `email` is OpenAPI's own field name for a contact, so the key stays as it is.
    ...(emailAddress === undefined ? {} : { email: emailAddress }),
  };
})();
