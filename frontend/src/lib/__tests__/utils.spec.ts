import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FONT_SIZES, cn } from '@/lib/utils'

describe('cn', () => {
  it('keeps a size and a colour apart, which is the reason for the extension', () => {
    expect(cn('text-note text-ink-5')).toBe('text-note text-ink-5')
  })

  it('still lets a later size beat an earlier one, and a colour a colour', () => {
    expect(cn('text-note', 'text-body')).toBe('text-body')
    expect(cn('text-ink-5', 'text-ink-2')).toBe('text-ink-2')
  })
})

describe('FONT_SIZES', () => {
  it('names every size the stylesheet declares', () => {
    const theme = readFileSync(
      resolve(import.meta.dirname, '../../assets/styles/theme.css'),
      'utf8',
    )
    // Hyphens have to be *in* the pattern: excluding them made `--text-page-title` match
    // nothing, so it was missing from both sides of the comparison and the test still passed.
    // The paired `--text-<name>--line-height` is the same size, not another one, so it goes
    // after the match rather than before it.
    const declared = [...theme.matchAll(/^\s*--text-([a-z0-9-]+):/gmu)]
      .flatMap((match) => match[1] ?? [])
      .filter((name) => !name.includes('--'))

    expect(new Set(FONT_SIZES)).toEqual(new Set(declared))
  })
})
