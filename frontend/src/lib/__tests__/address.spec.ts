import { describe, expect, it } from 'vitest'
import { addressFrom } from '@/lib/address'

const NO_ADDRESS = {}

describe('addressFrom', () => {
  it('is nothing when the operator gave no address, which is allowed', () => {
    expect(addressFrom(NO_ADDRESS)).toBeUndefined()
  })

  it('takes postal code and town together', () => {
    expect(addressFrom({ ...NO_ADDRESS, postalCode: '12345', city: 'Musterstadt' })).toEqual({
      town: '12345 Musterstadt',
    })
  })

  it('keeps the street when there is one', () => {
    expect(
      addressFrom({
        ...NO_ADDRESS,
        street: 'Musterstraße 1',
        postalCode: '12345',
        city: 'Musterstadt',
      }),
    ).toEqual({ street: 'Musterstraße 1', town: '12345 Musterstadt' })
  })

  // Half an address is worse than none: „12345" alone on a line says nothing, and a street
  // without a town cannot be found.
  it('refuses half an address rather than printing it', () => {
    expect(addressFrom({ ...NO_ADDRESS, postalCode: '12345' })).toBeUndefined()
    expect(addressFrom({ ...NO_ADDRESS, city: 'Musterstadt' })).toBeUndefined()
    expect(addressFrom({ ...NO_ADDRESS, street: 'Musterstraße 1' })).toBeUndefined()
  })
})
