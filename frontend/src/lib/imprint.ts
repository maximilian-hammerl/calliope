/**
 * Supplied per deployment, never committed: an Impressum carries a real name and often a home
 * address, and this repository is public. It is also wrong for every instance but one.
 */
import { getOptionalEnvVariable, getRequiredEnvVariable } from '@/lib/env'

export type Imprint = {
  name: string
  emailAddress: string
  street?: string
  postalCode?: string
  city?: string
  telephone?: string
}

/** The build refuses without the two required ones; this is the same rule for the dev server. */
export const IMPRINT: Imprint = {
  name: getRequiredEnvVariable(import.meta.env.VITE_IMPRINT_NAME, 'VITE_IMPRINT_NAME'),
  emailAddress: getRequiredEnvVariable(
    import.meta.env.VITE_IMPRINT_EMAIL_ADDRESS,
    'VITE_IMPRINT_EMAIL_ADDRESS',
  ),
  street: getOptionalEnvVariable(import.meta.env.VITE_IMPRINT_STREET),
  postalCode: getOptionalEnvVariable(import.meta.env.VITE_IMPRINT_POSTAL_CODE),
  city: getOptionalEnvVariable(import.meta.env.VITE_IMPRINT_CITY),
  telephone: getOptionalEnvVariable(import.meta.env.VITE_IMPRINT_TELEPHONE),
}

export type Address = { street?: string; town: string }

/** Both or neither: „12345" alone says nothing, and a street with no town cannot be found. */
export function addressOf(imprint: Imprint): Address | undefined {
  if (imprint.postalCode === undefined || imprint.city === undefined) {
    return undefined
  }

  const town = `${imprint.postalCode} ${imprint.city}`
  return { ...(imprint.street === undefined ? {} : { street: imprint.street }), town }
}

export const IMPRINT_ADDRESS: Address | undefined = addressOf(IMPRINT)
