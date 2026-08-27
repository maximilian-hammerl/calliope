import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { h } from 'vue'
import FilterStrip from '../FilterStrip.vue'
import FilterStrips from '../FilterStrips.vue'

const OPTIONS = [
  { value: 'all', label: 'Alle' },
  { value: 'favourite', label: 'Favoriten' },
] as const

function strip(props: Record<string, unknown> = {}) {
  return mount(FilterStrip, {
    props: { modelValue: 'all', label: 'Favoriten', options: OPTIONS, ...props },
  })
}

describe('FilterStrip', () => {
  it('names its group from its own label', () => {
    const wrapper = strip()
    const id = wrapper.get('[role="group"]').attributes('aria-labelledby')
    expect(wrapper.get(`#${id}`).text()).toBe('Favoriten')
  })

  /**
   * The id used to come from the label, so two „Favoriten" strips on one screen — the chats dialog
   * over the groups list — shared it, and the dialog's group was named by the label behind the
   * modal, which `aria-modal` hides from the tree.
   */
  it('gives each instance its own id, even with the same label', () => {
    // One mount, because `useId` counts per app — two `mount` calls would each start at v-0 and
    // agree by accident, which is the opposite of what this is checking.
    const both = mount({
      render: () => [
        h(FilterStrip, { modelValue: 'all', label: 'Favoriten', options: OPTIONS }),
        h(FilterStrip, { modelValue: 'all', label: 'Favoriten', options: OPTIONS }),
      ],
    })
    const ids = both.findAll('[role="group"]').map((g) => g.attributes('aria-labelledby'))
    expect(ids).toHaveLength(2)
    expect(new Set(ids).size).toBe(2)
  })

  /** Alone it owns the two columns; the rule used to live in the parent, where it was forgotten. */
  it('lays out its own label when it stands alone', () => {
    expect(strip().classes()).toContain('md:grid')
  })

  it('dissolves into the shared column inside FilterStrips', () => {
    const wrapper = mount(FilterStrips, {
      slots: {
        default: () => h(FilterStrip, { modelValue: 'all', label: 'Favoriten', options: OPTIONS }),
      },
    })
    const inner = wrapper.getComponent(FilterStrip)
    expect(inner.classes()).toContain('md:contents')
    expect(inner.classes()).not.toContain('md:grid')
  })

  /** A hidden label occupies no column, so a grid would only indent the options by the gap. */
  it('opens no column for a label nobody sees', () => {
    const classes = strip({ hideLabel: true }).classes()
    expect(classes).not.toContain('md:grid')
    expect(classes).not.toContain('md:contents')
  })
})
