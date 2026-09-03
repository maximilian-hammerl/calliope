/**
 * The frontend's half of `backend/src/util/env.ts` — same names, same rule that a blank variable
 * is unset, same message. Four lines twice, like `assertUnreachable.ts`.
 *
 * Takes the value, not the key: Vite replaces `import.meta.env.VITE_X` statically and documents
 * dynamic access as unsupported. It works today, but an upgrade would silently drop the optional
 * fields.
 */
export function getOptionalEnvVariable(value: string | undefined): string | undefined {
  const trimmedValue = value?.trim()
  return trimmedValue ? trimmedValue : undefined
}

export function getRequiredEnvVariable(value: string | undefined, key: string): string {
  const present = getOptionalEnvVariable(value)
  if (present === undefined) {
    throw new Error(`Environment variable ${key} is not set`)
  }
  return present
}
