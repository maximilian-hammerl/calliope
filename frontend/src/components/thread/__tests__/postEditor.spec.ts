import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import type { PostDocument } from '@/api/models'
import PostEditor from '@/components/thread/PostEditor.vue'

/**
 * The toolbar is three menus and a selection bubble (#81). What is worth pinning is the grouping
 * itself — which control sits in which menu is a decision, not an accident — and that the bubble's
 * curated set stays curated.
 */
const STYLED: PostDocument = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        {
          // All three on one node deliberately: the cursor starts at the document's beginning, so
          // marks on a *later* node are out of range and an assertion about them proves nothing.
          type: 'text',
          text: 'fett und verlinkt',
          marks: [
            { type: 'bold' },
            {
              type: 'textStyle',
              attrs: { color: '#c00', backgroundColor: 'yellow', fontSize: '22pt' },
            },
            { type: 'link', attrs: { href: 'https://example.org' } },
          ],
        },
      ],
    },
  ],
}

/** Bold alone is styling too — the control is not only an escape hatch for pasted attributes. */
const BOLD_ONLY: PostDocument = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'fett', marks: [{ type: 'bold' }] }],
    },
  ],
}

const PLAIN: PostDocument = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'nichts' }] }],
}

function editorFor(content: PostDocument) {
  return mount(PostEditor, {
    props: { document: content, text: 'text' },
    attachTo: window.document.body,
  })
}

/** reka renders menu content on open and settles a frame later, hence the yield. */
async function open(wrapper: ReturnType<typeof editorFor>, label: string) {
  await wrapper
    .findAll('button')
    .find((candidate) => candidate.text().startsWith(label))
    ?.trigger('click')
  await nextTick()
  await new Promise((resolve) => setTimeout(resolve, 80))
}

const ITEM = '[role="menuitem"],[role="menuitemcheckbox"],[role="menuitemradio"]'

function items(): string[] {
  return [...window.document.querySelectorAll(ITEM)].map((node) => node.textContent?.trim() ?? '')
}

function item(text: string): HTMLElement | undefined {
  return [...window.document.querySelectorAll<HTMLElement>(ITEM)].find(
    (node) => node.textContent?.trim() === text,
  )
}

async function expectOffered(content: PostDocument) {
  const wrapper = editorFor(content)
  await nextTick()
  await open(wrapper, 'Zeichen')
  expect(item('Formatierung entfernen')?.getAttribute('aria-disabled')).not.toBe('true')
  wrapper.unmount()
}

describe('PostEditor', () => {
  it('groups the paragraph controls, alignment included', async () => {
    const wrapper = editorFor(PLAIN)
    await nextTick()
    await open(wrapper, 'Absatz')

    expect(items()).toEqual([
      'Überschrift',
      'Zwischenüberschrift',
      'Liste',
      'Nummerierte Liste',
      'Zitat',
      'Linksbündig',
      'Zentriert',
      'Rechtsbündig',
      'Blocksatz',
    ])
    wrapper.unmount()
  })

  it('groups the character controls, with removing formatting at the foot', async () => {
    const wrapper = editorFor(PLAIN)
    await nextTick()
    await open(wrapper, 'Zeichen')

    expect(items()).toEqual([
      'Fett',
      'Kursiv',
      'Unterstrichen',
      'Durchgestrichen',
      'Code',
      'Formatierung entfernen',
    ])
    wrapper.unmount()
  })

  it('keeps inserting separate from formatting', async () => {
    const wrapper = editorFor(PLAIN)
    await nextTick()
    await open(wrapper, 'Einfügen')

    expect(items()).toEqual(['Link', 'Trennlinie'])
    wrapper.unmount()
  })

  it('offers four of the five character toggles in the bubble', async () => {
    const wrapper = editorFor(PLAIN)
    await nextTick()

    // Deliberately not all five: `Code` is excluded by judgement, and a later tidy-up that adds it
    // back for symmetry should fail here rather than ship.
    const labels = wrapper
      .findAll('button')
      .map((button) => button.attributes('aria-label'))
      .filter((label) => label !== undefined)

    expect(labels).toContain('Durchgestrichen')
    expect(labels).not.toContain('Code')
    wrapper.unmount()
  })

  it('offers to remove styling only when there is some', async () => {
    const plain = editorFor(PLAIN)
    await nextTick()
    await open(plain, 'Zeichen')
    expect(item('Formatierung entfernen')?.getAttribute('aria-disabled')).toBe('true')
    plain.unmount()

    await expectOffered(STYLED)
    await expectOffered(BOLD_ONLY)
  })

  it('clears every character mark, and keeps the link', async () => {
    const wrapper = editorFor(STYLED)
    await nextTick()
    await open(wrapper, 'Zeichen')

    item('Formatierung entfernen')?.click()
    await nextTick()

    const latest = wrapper.emitted('update:document')?.at(-1)?.[0] as PostDocument
    const text = JSON.stringify(latest)

    expect(text).not.toContain('textStyle')
    expect(text).not.toContain('#c00')
    // Bold goes with the rest: the label promises to remove formatting, and a Word paste brings
    // bold along with the colour, so clearing one and leaving the other cleans nothing.
    expect(text).not.toContain('bold')
    // The link is not formatting — dropping it would lose the address.
    expect(text).toContain('https://example.org')
    wrapper.unmount()
  })
})
