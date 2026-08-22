import { describe, expect, it } from 'vitest'
import { pluralize, paragraphs } from '../formatText'

describe('paragraphs', () => {
  it('splits on blank lines and drops the empties a stray return leaves', () => {
    expect(paragraphs('Erster Absatz.\n\n\n  Zweiter Absatz.  \n\n')).toEqual([
      'Erster Absatz.',
      'Zweiter Absatz.',
    ])
  })

  it('keeps a single newline inside a paragraph, since that is not a break', () => {
    expect(paragraphs('Eine Zeile\nund noch eine')).toEqual(['Eine Zeile\nund noch eine'])
  })
})

describe('pluralize', () => {
  it('gives every number a noun', () => {
    expect(pluralize(14, 'Beitrag', 'Beiträge')).toBe('14 Beiträge')
    expect(pluralize(1, 'Beitrag', 'Beiträge')).toBe('1 Beitrag')
    expect(pluralize(0, 'Beitrag', 'Beiträge')).toBe('0 Beiträge')
  })

  it('groups the count, so it reads like every other number a member sees', () => {
    expect(pluralize(1234, 'Mitglied', 'Mitglieder')).toBe('1.234 Mitglieder')
  })
})
