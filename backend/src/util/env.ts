export function getOptionalEnvVariable(key: string): string | undefined {
  const value = Deno.env.get(key);
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : undefined;
}

export function getRequiredEnvVariable(key: string): string {
  const value = getOptionalEnvVariable(key);
  if (value === undefined) {
    throw new Error(`Environment variable ${key} is not set`);
  }
  return value;
}
