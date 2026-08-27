import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import UserAvatar from '../UserAvatar.vue'

describe('UserAvatar', () => {
  it('shows the initial when there is no picture', () => {
    const wrapper = mount(UserAvatar, { props: { username: 'tintenfleck' } })
    expect(wrapper.text()).toBe('T')
    expect(wrapper.find('img').exists()).toBe(false)
  })

  it('renders the picture when there is one', () => {
    const wrapper = mount(UserAvatar, {
      props: { username: 'tintenfleck', avatarUrl: '/api/avatars/01a0-x' },
    })
    expect(wrapper.find('img').attributes('src')).toBe('/api/avatars/01a0-x')
  })

  /**
   * The name is already beside every avatar in this interface, so an alt would be read twice.
   * The initial underneath is what a screen reader falls back to if the image fails.
   */
  it('leaves the picture unlabelled, because the name is already next to it', () => {
    const wrapper = mount(UserAvatar, {
      props: { username: 'tintenfleck', avatarUrl: '/api/avatars/01a0-x' },
    })
    expect(wrapper.find('img').attributes('alt')).toBe('')
  })

  it('keeps the initial available as the fallback even with a picture', () => {
    const wrapper = mount(UserAvatar, {
      props: { username: 'tintenfleck', avatarUrl: '/api/avatars/01a0-x' },
    })
    // A sibling, not a `v-else`: reka swaps to it when the source fails to load.
    expect(wrapper.text()).toContain('T')
  })

  it('takes the larger size where a profile asks for it', () => {
    const large = mount(UserAvatar, { props: { username: 'mira', size: 'lg' } })
    const small = mount(UserAvatar, { props: { username: 'mira' } })
    expect(large.classes()).toContain('size-12')
    expect(small.classes()).toContain('size-7')
  })
})
