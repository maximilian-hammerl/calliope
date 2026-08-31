import { describe, expect, it } from 'vitest'
import {
  GENRES,
  GENRE_LABELS,
  SUBGENRE_LABELS,
  afterChoosingGenres,
  emptySelection,
  subgenresFor,
} from '@/lib/story/storyVocabulary'
import type { Genre } from '@/lib/story/storyVocabulary'

describe('subgenresFor', () => {
  it('offers only the subgenres of the genres picked', () => {
    const offered = subgenresFor(['fantasy']).map((option) => option.value)

    expect(offered).toEqual([...GENRES.fantasy.subgenres])
    expect(offered).not.toContain('space_opera')
  })

  it('offers nothing when no genre is picked, which is what hides the field', () => {
    expect(subgenresFor([])).toEqual([])
  })

  it('carries the German word rather than the stored value', () => {
    expect(subgenresFor(['fantasy'])).toContainEqual({
      value: 'dark_fantasy',
      label: 'Dark Fantasy',
    })
  })
})

describe('afterChoosingGenres', () => {
  it('drops a subgenre whose genre has just gone', () => {
    const chosen = afterChoosingGenres(
      {
        ...emptySelection(),
        genres: ['fantasy', 'western'],
        subgenres: ['dark_fantasy', 'weird_western'],
      },
      ['western'],
    )

    // Otherwise the board would narrow by a value nobody can see any more.
    expect(chosen.subgenres).toEqual(['weird_western'])
  })

  it('keeps the ones still on offer', () => {
    const chosen = afterChoosingGenres(
      { ...emptySelection(), genres: ['fantasy'], subgenres: ['dark_fantasy'] },
      ['fantasy', 'horror'],
    )

    expect(chosen.subgenres).toEqual(['dark_fantasy'])
    expect(chosen.genres).toEqual(['fantasy', 'horror'])
  })

  it('leaves everything else on the selection alone', () => {
    const chosen = afterChoosingGenres({ ...emptySelection(), tropes: ['slow_burn'] }, ['fantasy'])

    expect(chosen.tropes).toEqual(['slow_burn'])
  })
})

describe('the vocabularies', () => {
  it('gives every genre and subgenre a German word', () => {
    // The exhaustive `Record` is the real guarantee; this catches a word left as its own value.
    for (const [value, label] of Object.entries(GENRE_LABELS)) {
      expect(label, `genre ${value}`).not.toBe(value)
    }
    for (const [value, label] of Object.entries(SUBGENRE_LABELS)) {
      expect(label, `subgenre ${value}`).not.toBe(value)
    }
  })

  it('places every subgenre under exactly one genre', () => {
    const placed = (Object.keys(GENRES) as Genre[]).flatMap((genre) =>
      GENRES[genre].subgenres.slice(),
    )

    expect(new Set(placed).size).toBe(placed.length)
    expect([...placed].sort()).toEqual(Object.keys(SUBGENRE_LABELS).sort())
  })
})
