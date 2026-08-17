export function getRequiredEnvVariable(key: string): string {
  const value = Deno.env.get(key);
  if (value === undefined) {
    throw new Error(`Environment variable ${key} is not set`);
  }
  return value;
}
