import { getOptionalEnvVariable, getRequiredEnvVariable } from '@/lib/env'
import type { Address } from '@/lib/address'
import { addressFrom } from '@/lib/address'

/** Who the deployment is hosted with, named in the privacy policy. Differs per instance. */
export type Hoster = {
  name: string
  street?: string
  postalCode?: string
  city?: string
}

export const HOSTER: Hoster = {
  name: getRequiredEnvVariable(import.meta.env.VITE_HOSTER_NAME, 'VITE_HOSTER_NAME'),
  street: getOptionalEnvVariable(import.meta.env.VITE_HOSTER_STREET),
  postalCode: getOptionalEnvVariable(import.meta.env.VITE_HOSTER_POSTAL_CODE),
  city: getOptionalEnvVariable(import.meta.env.VITE_HOSTER_CITY),
}

export const HOSTER_ADDRESS: Address | undefined = addressFrom(HOSTER)
