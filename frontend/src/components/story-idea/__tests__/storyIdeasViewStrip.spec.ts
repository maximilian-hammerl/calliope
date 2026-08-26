import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import StoryIdeasViewStrip from '@/components/story-idea/StoryIdeasViewStrip.vue'

/**
 * Three views behind one destination, so all three have to be named and reachable in one press
 * from any of them — the carousel included, which is the one the bar now opens.
 */
const blank = { template: '<div />' }

async function stripAt(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/story-ideas/carousel', name: 'storyIdeasCarousel', component: blank },
      { path: '/story-ideas/mine', name: 'myStoryIdeas', component: blank },
      { path: '/story-ideas/discover', name: 'discoverStoryIdeas', component: blank },
    ],
  })
  await router.push(path)
  await router.isReady()

  return { wrapper: mount(StoryIdeasViewStrip, { global: { plugins: [router] } }), router }
}

describe('StoryIdeasViewStrip', () => {
  it('names all three views, the primary one first', async () => {
    const { wrapper } = await stripAt('/story-ideas/carousel')

    expect(wrapper.findAll('button').map((button) => button.text())).toEqual([
      'Karussell',
      'Meine Ideen',
      'Ideen entdecken',
    ])
  })

  it('marks whichever view is being read', async () => {
    const marked = await Promise.all(
      ['/story-ideas/carousel', '/story-ideas/mine', '/story-ideas/discover'].map(async (path) => {
        const { wrapper } = await stripAt(path)
        return wrapper.find('[aria-pressed="true"]').text()
      }),
    )

    expect(marked).toEqual(['Karussell', 'Meine Ideen', 'Ideen entdecken'])
  })

  it('reaches every other view in one press', async () => {
    const { wrapper, router } = await stripAt('/story-ideas/carousel')

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Ideen entdecken')
      ?.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('discoverStoryIdeas')
  })
})
