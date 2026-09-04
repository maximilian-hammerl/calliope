import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ForumPermissionField from '@/components/forum/ForumPermissionField.vue'
import { forumPermissionChoices } from '@/lib/format/forum'

/**
 * One field for the three kinds that carry a permission, which is what keeps the wording from
 * drifting between the folder's dialog and the leaf's. Only the hidden case names what
 * disappears, so only that sentence differs.
 */

type Kind = 'folder' | 'thread' | 'page'

const noteFor = (value: 'write' | 'read' | 'hidden', kind: Kind) =>
  forumPermissionChoices(kind).find((choice) => choice.value === value)?.note

const hiddenNote = (kind: Kind) => noteFor('hidden', kind)

function field(kind: Kind) {
  return mount(ForumPermissionField, {
    props: { kind, modelValue: 'write' },
  })
}

describe('the choices an operator picks between', () => {
  it('offers the three, most open first', () => {
    expect(forumPermissionChoices('folder').map((choice) => choice.value)).toEqual([
      'write',
      'read',
      'hidden',
    ])
  })

  /** „read" says nothing about whether a member can answer, so the label says what it grants. */
  it('labels what each one grants rather than naming the value', () => {
    expect(forumPermissionChoices('thread').map((choice) => choice.label)).toEqual([
      'Mitschreiben',
      'Nur lesen',
      'Verborgen',
    ])
  })

  it('names what disappears, which is the only sentence that differs by kind', () => {
    expect(hiddenNote('folder')).toBe('Nur die Moderation sieht den Ordner und alles darin.')
    expect(hiddenNote('thread')).toBe('Nur die Moderation sieht das Thema.')
    expect(hiddenNote('page')).toBe('Nur die Moderation sieht die Seite.')

    // The other two are the same sentence whatever it is, so they are written once.
    for (const value of ['write', 'read'] as const) {
      expect(noteFor(value, 'folder')).toBe(noteFor(value, 'thread'))
      expect(noteFor(value, 'thread')).toBe(noteFor(value, 'page'))
    }
  })
})

describe('the field itself', () => {
  it('renders one radio per choice, with the current one checked', () => {
    const wrapper = field('thread')
    const radios = wrapper.findAll('[role="radio"]')

    expect(radios).toHaveLength(3)
    expect(radios.map((radio) => radio.attributes('aria-checked'))).toEqual([
      'true',
      'false',
      'false',
    ])
  })

  it('carries the kind through to the sentence on screen', () => {
    expect(field('page').text()).toContain('Nur die Moderation sieht die Seite.')
    expect(field('folder').text()).toContain('Nur die Moderation sieht den Ordner und alles darin.')
  })

  /** The 44px phone target belongs on the label, not the 16px dot — see the design system. */
  it('puts the tap target on the label that wraps each radio', () => {
    const labels = field('thread').findAll('label')

    expect(labels).toHaveLength(3)
    for (const label of labels) {
      expect(label.classes()).toContain('min-h-11')
    }
  })
})
