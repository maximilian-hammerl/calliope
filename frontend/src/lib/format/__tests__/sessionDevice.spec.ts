import { describe, expect, it } from 'vitest'
import { sessionDevice } from '@/lib/format/sessionDevice'

describe('sessionDevice', () => {
  it('names the brand beside the kind, which is what a member recognises', () => {
    expect(
      sessionDevice({
        browser: 'Safari',
        operatingSystem: 'iOS',
        deviceType: 'mobile',
        vendor: 'Apple',
      }),
    ).toBe('Safari auf iOS · Apple Handy')
  })

  it('names the brand alone on a desktop, which the parser gives no kind', () => {
    expect(
      sessionDevice({
        browser: 'Safari',
        operatingSystem: 'macOS',
        deviceType: null,
        vendor: 'Apple',
      }),
    ).toBe('Safari auf macOS · Apple')
  })

  it('names the kind alone where the brand is missing, as on a reduced Android agent', () => {
    expect(
      sessionDevice({
        browser: 'Chrome',
        operatingSystem: 'Android',
        deviceType: 'mobile',
        vendor: null,
      }),
    ).toBe('Chrome auf Android · Handy')
  })

  it('says the platform alone when neither is known', () => {
    expect(
      sessionDevice({
        browser: 'Chrome',
        operatingSystem: 'Windows',
        deviceType: null,
        vendor: null,
      }),
    ).toBe('Chrome auf Windows')
  })

  it('says whichever half of the platform it has', () => {
    expect(
      sessionDevice({
        browser: 'Firefox',
        operatingSystem: null,
        deviceType: null,
        vendor: null,
      }),
    ).toBe('Firefox')
    expect(
      sessionDevice({
        browser: null,
        operatingSystem: 'Android',
        deviceType: null,
        vendor: null,
      }),
    ).toBe('Android')
  })

  it('falls back to the device alone, and then to a name, rather than showing an empty row', () => {
    expect(
      sessionDevice({
        browser: null,
        operatingSystem: null,
        deviceType: 'tablet',
        vendor: 'Amazon',
      }),
    ).toBe('Amazon Tablet')
    expect(
      sessionDevice({ browser: null, operatingSystem: null, deviceType: null, vendor: null }),
    ).toBe('Unbekanntes Gerät')
  })

  it('leaves a kind it has no word for off rather than guessing', () => {
    expect(
      sessionDevice({
        browser: 'Chrome',
        operatingSystem: 'Linux',
        deviceType: 'embedded',
        vendor: null,
      }),
    ).toBe('Chrome auf Linux · Embedded')
  })
})
