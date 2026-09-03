import { getRequiredEnvVariable } from '@/lib/env'

/** Defaulted in `vite.config.ts`, so this throw only fires if that default is ever removed. */
export const APP_NAME: string = getRequiredEnvVariable(
  import.meta.env.PUBLIC_APP_NAME,
  'PUBLIC_APP_NAME',
)
