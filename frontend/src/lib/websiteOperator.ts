/**
 * Whoever runs this deployment: the Impressum's „Diensteanbieter" and the privacy policy's
 * „verantwortliche Stelle" are the same person, so one set of values serves both. Named for who
 * they are rather than for either statute, and not `OPERATOR_` — that word already means a member
 * holding a platform role.
 *
 * Supplied per deployment, never committed: this carries a real name and often a home address,
 * and the repository is public.
 */
import type { Address } from '@/lib/address'
import { addressFrom } from '@/lib/address'
import { getOptionalEnvVariable, getRequiredEnvVariable } from '@/lib/env'

export type WebsiteOperator = {
  name: string
  emailAddress: string
  street?: string
  postalCode?: string
  city?: string
  telephoneNumber?: string
}

/** The build refuses without the two required ones; this is the same rule for the dev server. */
export const WEBSITE_OPERATOR: WebsiteOperator = {
  name: getRequiredEnvVariable(
    import.meta.env.VITE_WEBSITE_OPERATOR_NAME,
    'VITE_WEBSITE_OPERATOR_NAME',
  ),
  emailAddress: getRequiredEnvVariable(
    import.meta.env.VITE_WEBSITE_OPERATOR_EMAIL_ADDRESS,
    'VITE_WEBSITE_OPERATOR_EMAIL_ADDRESS',
  ),
  street: getOptionalEnvVariable(import.meta.env.VITE_WEBSITE_OPERATOR_STREET),
  postalCode: getOptionalEnvVariable(import.meta.env.VITE_WEBSITE_OPERATOR_POSTAL_CODE),
  city: getOptionalEnvVariable(import.meta.env.VITE_WEBSITE_OPERATOR_CITY),
  telephoneNumber: getOptionalEnvVariable(import.meta.env.VITE_WEBSITE_OPERATOR_TELEPHONE_NUMBER),
}

export const WEBSITE_OPERATOR_ADDRESS: Address | undefined = addressFrom(WEBSITE_OPERATOR)
