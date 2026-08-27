import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import GroupsViewStrip from '@/components/group/GroupsViewStrip.vue'

/**
 * The strip replaces the Gruppen dropdown in both bars, so what matters is that it names both
 * views wherever it is shown, marks the one being read, and navigates in a single press.
 * Discovery being visible is the whole point — it was missed once when it sat below the list.
 */
const blank = { template: '<div />' }

async function stripAt(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/groups/mine', name: 'myGroups', component: blank },
      { path: '/groups/discover', name: 'discoverGroups', component: blank },
    ],
  })
  await router.push(path)
  await router.isReady()

  return { wrapper: mount(GroupsViewStrip, { global: { plugins: [router] } }), router }
}

describe('GroupsViewStrip', () => {
  it('names both views on the groups page', async () => {
    const { wrapper } = await stripAt('/groups/mine')

    expect(wrapper.findAll('button').map((button) => button.text())).toEqual([
      'Meine Gruppen',
      'Gruppen entdecken',
    ])
  })

  it('marks the view being read, on either page', async () => {
    const mine = await stripAt('/groups/mine')
    expect(mine.wrapper.find('[aria-pressed="true"]').text()).toBe('Meine Gruppen')

    const discovering = await stripAt('/groups/discover')
    expect(discovering.wrapper.find('[aria-pressed="true"]').text()).toBe('Gruppen entdecken')
  })

  it('navigates to discovery in one press', async () => {
    const { wrapper, router } = await stripAt('/groups/mine')

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Gruppen entdecken')
      ?.trigger('click')
    // `trigger` awaits Vue's tick; the navigation is a promise of the router's own.
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('discoverGroups')
  })
})
