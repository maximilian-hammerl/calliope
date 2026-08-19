import { describe, expect, it } from 'vitest'
import { userInitial } from '@/lib/format/formatUser'

describe('userInitial', () => {
  it('takes the first letter, upper-cased', () => {
    expect(userInitial('mira')).toBe('M')
  })

  it('ignores surrounding whitespace', () => {
    expect(userInitial('  bob ')).toBe('B')
  })

  it('upper-cases German letters correctly', () => {
    expect(userInitial('änne')).toBe('Ä')
  })

  // charAt would return a lone surrogate here, which renders as a replacement character.
  it('keeps an astral first character whole', () => {
    expect(userInitial('𝔎lara')).toBe('𝔎')
  })

  it('is empty for a blank name rather than throwing', () => {
    expect(userInitial('   ')).toBe('')
  })
})
