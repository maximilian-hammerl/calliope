import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AvatarPicker from '../AvatarPicker.vue'
import { AVATAR_ORIGIN_LABELS, OWN_WORK } from '@/lib/format/avatar'

function picker(overrides: Record<string, unknown> = {}) {
  return mount(AvatarPicker, {
    props: {
      username: 'tintenfleck',
      currentUrl: null,
      file: undefined,
      origin: OWN_WORK,
      credit: '',
      confirmed: false,
      ...overrides,
    },
  })
}

describe('AvatarPicker', () => {
  it('offers a file field that accepts only what the server accepts', () => {
    const input = picker().find('input[type="file"]')
    expect(input.exists()).toBe(true)
    // SVG is absent from both, deliberately.
    expect(input.attributes('accept')).toBe('image/jpeg,image/png,image/webp')
  })

  /** Nothing is owed until a picture is actually chosen. */
  it('asks nothing before a file is chosen', () => {
    const wrapper = picker()
    expect(wrapper.text()).not.toContain('Woher stammt das Bild?')
    expect(wrapper.findAll('[role="radio"]')).toHaveLength(0)
  })

  it('asks where the picture came from once one is chosen', () => {
    const wrapper = picker({ file: new File(['x'], 'a.png', { type: 'image/png' }) })
    expect(wrapper.text()).toContain('Woher stammt das Bild?')
    expect(wrapper.findAll('[role="radio"]')).toHaveLength(Object.keys(AVATAR_ORIGIN_LABELS).length)
  })

  /**
   * The common case is one click. Asking everybody for a source is what turns a declaration into
   * a field people type „meins" into — see #29 on Yooco's required fields.
   */
  it('asks for a credit only where one is owed', () => {
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    expect(picker({ file }).find('#avatar-credit').exists()).toBe(false)
    expect(picker({ file, origin: 'licence' }).find('#avatar-credit').exists()).toBe(true)
  })

  it('shows the size in a unit somebody can read', () => {
    const file = new File([new Uint8Array(2048)], 'katze.png', { type: 'image/png' })
    expect(picker({ file }).text()).toContain('2 KB')
  })

  it('shows the current picture until another is chosen', () => {
    const wrapper = picker({ currentUrl: '/api/avatars/01a0-x' })
    expect(wrapper.find('img').attributes('src')).toBe('/api/avatars/01a0-x')
  })
})
