import { getRequiredEnvVariable } from '@/lib/env'

/** Defaulted in `vite.config.ts`, so this throw only fires if that default is ever removed. */
export const APP_NAME: string = getRequiredEnvVariable(
  import.meta.env.PUBLIC_APP_NAME,
  'PUBLIC_APP_NAME',
)

/** The footer's way to the code. Defaulted in `vite.config.ts` like the name above. */
export const SOURCE_URL: string = getRequiredEnvVariable(
  import.meta.env.PUBLIC_SOURCE_URL,
  'PUBLIC_SOURCE_URL',
)
