import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import SearchResults from '@/components/search/SearchResults.vue'
import type { Search200 } from '@/api/models'

/**
 * The forum's matches are their own sections rather than rows in the group's, and each sits
 * directly after its counterpart: „Themen" above „Themen im Forum" is what says the first one
 * means a group, without spending a word on it. A section with no results is left out entirely,
 * which is why the group's two stay unqualified.
 */

/**
 * The first `vi.mock` in these specs, and the reason is worth knowing: this component calls two
 * vue-query composables at setup, so mounting it otherwise needs a `QueryClient` and a stubbed
 * `fetch` — which would make the test about the session rather than about the sections. Every
 * other component spec here tests a component that takes props only and needs none of this.
 */
vi.mock('@/api/auth/auth', () => ({
  useGetCurrentUser: () => ({ data: { value: undefined } }),
}))

/**
 * A real `ref`, not a `{ value }` object: a template unwraps only an actual ref, so a plain object
 * is always truthy in `v-if` — which made the mark look unconditional when it is not.
 */
const operator = ref<boolean>(false)
vi.mock('@/composables/useIsOperator', () => ({ useIsOperator: () => operator }))

const stubs = {
  RouterLink: defineComponent({
    props: { to: { type: [String, Object], required: true } },
    setup:
      (props, { slots }) =>
      () =>
        h('a', { 'data-to': JSON.stringify(props.to) }, slots.default?.()),
  }),
  FavouriteMark: true,
  ForumPermissionMark: true,
  VisibilityMark: true,
  StatusMark: true,
  ReadMark: true,
  CalliopeBadge: true,
}

const empty = { results: [], totalResults: 0 }

function section(...titles: Array<string>) {
  return {
    results: titles.map((title, index) => ({
      id: `id-${index}-${title}`,
      title,
      isFavourite: false,
      writingGroupId: 'g-1',
      writingGroupTitle: 'Der Zauberzwerg',
      effectiveMemberPermission: 'write',
    })),
    totalResults: titles.length,
  }
}

function mountResults(found: Record<string, unknown>) {
  return mount(SearchResults, {
    props: {
      results: { groups: empty, storyIdeas: empty, users: empty, ...found } as unknown as Search200,
      isSearching: false,
      termIsLongEnough: true,
      minimumLength: 3,
    },
    global: { stubs },
  })
}

/** The stub renders as its own element, so counting them is how the mark is observed. */
function marks(found: Record<string, unknown>): number {
  return mountResults(found).findAll('forum-permission-mark-stub').length
}

function headings(found: Record<string, unknown>): Array<string> {
  const wrapper = mount(SearchResults, {
    props: {
      // The component takes the whole response; only the sections matter here.
      results: {
        groups: empty,
        storyIdeas: empty,
        users: empty,
        ...found,
      } as unknown as Search200,
      isSearching: false,
      termIsLongEnough: true,
      minimumLength: 3,
    },
    global: { stubs },
  })

  return wrapper
    .findAll('div.font-semibold')
    .map((node) => node.text())
    .filter((text) => text.length > 0)
}

describe('the search popover keeps the forum in its own sections', () => {
  it('puts each forum section directly after its counterpart', () => {
    expect(
      headings({
        threads: section('Kapitel 1'),
        forumThreads: section('Wortkette'),
        pages: section('Stadt A'),
        forumPages: section('Regeln'),
      }),
    ).toEqual(['Themen', 'Themen im Forum', 'Seiten', 'Seiten im Forum'])
  })

  /** The common case, and the reason the group's two need no qualifier. */
  it('leaves the forum out entirely when it matched nothing', () => {
    expect(headings({ threads: section('Kapitel 1'), forumThreads: empty })).toEqual(['Themen'])
  })

  it('shows the forum alone when only it matched', () => {
    expect(headings({ threads: empty, forumThreads: section('Wortkette') })).toEqual([
      'Themen im Forum',
    ])
  })

  it('links a forum result into the forum, not into a group', () => {
    const wrapper = mount(SearchResults, {
      props: {
        results: {
          groups: empty,
          storyIdeas: empty,
          users: empty,
          threads: empty,
          pages: empty,
          forumThreads: section('Wortkette'),
          forumPages: section('Regeln'),
        } as unknown as Search200,
        isSearching: false,
        termIsLongEnough: true,
        minimumLength: 3,
      },
      global: { stubs },
    })

    // The rows carry a `writingGroupId` a group's row would route by, so this fails if the
    // section's own scope is not what decides.
    const targets = wrapper.findAll('a').map((node) => node.attributes('data-to'))
    expect(targets).toEqual([
      JSON.stringify({ name: 'forumThread', params: { threadId: 'id-0-Wortkette' } }),
      JSON.stringify({ name: 'forumPage', params: { pageId: 'id-0-Regeln' } }),
    ])
  })

  /**
   * An operator's search reaches rows members cannot see, so a forum row has to say when it is
   * hidden — without this, unpublished notes look published in the results.
   */
  it('marks a forum row for an operator and not for a member', () => {
    const found = {
      threads: empty,
      pages: empty,
      forumThreads: section('Wortkette'),
      forumPages: empty,
    }

    operator.value = false
    expect(marks(found)).toBe(0)

    operator.value = true
    expect(marks(found)).toBe(1)
    operator.value = false
  })
})
