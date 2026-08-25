import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import type { PostDocument } from '@/api/models'
import PostEditor from '@/components/thread/PostEditor.vue'

/**
 * A paste from a word processor carries span-level styling, and until #81 builds the pickers there
 * is no control that shows or changes it. „Formatierung entfernen" is the way back out, so what it
 * removes — and what it leaves alone — is the part worth pinning.
 */
const STYLED: PostDocument = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'fett',
          marks: [
            { type: 'bold' },
            {
              type: 'textStyle',
              attrs: { color: '#c00', backgroundColor: 'yellow', fontSize: '22pt' },
            },
          ],
        },
      ],
    },
  ],
}

function editorFor(content: PostDocument) {
  return mount(PostEditor, {
    props: { document: content, text: 'fett' },
    attachTo: window.document.body,
  })
}

function button(wrapper: ReturnType<typeof editorFor>) {
  return wrapper
    .findAll('button')
    .find((candidate) => candidate.attributes('aria-label') === 'Formatierung entfernen')
}

describe('PostEditor', () => {
  it('offers to remove styling only when there is some', async () => {
    const plain = editorFor({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'nichts' }] }],
    })
    await nextTick()

    // A control that does nothing does not ship — and being enabled is how a member finds out a
    // paste brought styling with it.
    expect(button(plain)?.attributes('disabled')).toBeDefined()
    plain.unmount()

    const styled = editorFor(STYLED)
    await nextTick()

    expect(button(styled)?.attributes('disabled')).toBeUndefined()
    styled.unmount()
  })

  it('clears the styling and spares the marks that have their own control', async () => {
    const wrapper = editorFor(STYLED)
    await nextTick()

    await button(wrapper)?.trigger('click')
    await nextTick()

    const emitted = wrapper.emitted('update:document')
    const latest = emitted?.at(-1)?.[0] as PostDocument
    const text = JSON.stringify(latest)

    expect(text).not.toContain('textStyle')
    expect(text).not.toContain('#c00')
    // Bold has a toggle of its own, so removing styling must not touch it.
    expect(text).toContain('bold')
    wrapper.unmount()
  })
})
