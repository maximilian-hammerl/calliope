import { describe, expect, it } from 'vitest'
import type { Imprint } from '@/lib/imprint'
import { addressOf } from '@/lib/imprint'

const REQUIRED: Imprint = { name: 'Erika Mustermann', emailAddress: 'erika@example.de' }

describe('addressOf', () => {
  it('is nothing when the operator gave no address, which is allowed', () => {
    expect(addressOf(REQUIRED)).toBeUndefined()
  })

  it('takes postal code and town together', () => {
    expect(addressOf({ ...REQUIRED, postalCode: '12345', city: 'Musterstadt' })).toEqual({
      town: '12345 Musterstadt',
    })
  })

  it('keeps the street when there is one', () => {
    expect(
      addressOf({
        ...REQUIRED,
        street: 'Musterstraße 1',
        postalCode: '12345',
        city: 'Musterstadt',
      }),
    ).toEqual({ street: 'Musterstraße 1', town: '12345 Musterstadt' })
  })

  // Half an address is worse than none: „12345" alone on a line says nothing, and a street
  // without a town cannot be found.
  it('refuses half an address rather than printing it', () => {
    expect(addressOf({ ...REQUIRED, postalCode: '12345' })).toBeUndefined()
    expect(addressOf({ ...REQUIRED, city: 'Musterstadt' })).toBeUndefined()
    expect(addressOf({ ...REQUIRED, street: 'Musterstraße 1' })).toBeUndefined()
  })
})
