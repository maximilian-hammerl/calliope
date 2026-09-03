import { describe, expect, it } from 'vitest'
import { getOptionalEnvVariable, getRequiredEnvVariable } from '@/lib/env'

/**
 * The contract these share with `backend/src/util/env.ts`. Two projects that share no code can
 * only stay in step by agreeing on the behaviour, so the behaviour is written down here.
 */
describe('getOptionalEnvVariable', () => {
  it('takes a value that says something', () => {
    expect(getOptionalEnvVariable('Musterstadt')).toBe('Musterstadt')
  })

  it('trims, because a shell assignment keeps what it was given', () => {
    expect(getOptionalEnvVariable('  Musterstadt  ')).toBe('Musterstadt')
  })

  // The rule worth pinning: a variable that exists but is blank has told us nothing, and
  // `.example.deploy.env` ships every optional one as `""`.
  it('reads blank and whitespace as unset', () => {
    expect(getOptionalEnvVariable('')).toBeUndefined()
    expect(getOptionalEnvVariable('   ')).toBeUndefined()
    expect(getOptionalEnvVariable(undefined)).toBeUndefined()
  })
})

describe('getRequiredEnvVariable', () => {
  it('returns the value when there is one', () => {
    expect(getRequiredEnvVariable('Erika', 'VITE_WEBSITE_OPERATOR_NAME')).toBe('Erika')
  })

  it('names the variable it is missing, in the backend’s words', () => {
    expect(() => getRequiredEnvVariable('  ', 'VITE_WEBSITE_OPERATOR_NAME')).toThrow(
      'Environment variable VITE_WEBSITE_OPERATOR_NAME is not set',
    )
  })
})
