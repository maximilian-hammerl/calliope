import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ListPagination from '../ListPagination.vue'

/**
 * The run of numbers is reka's now (`siblingCount` and `showEdges`) rather than a computed of our
 * own, so what is pinned here is the shape that has to survive that: the current page with a
 * neighbour either side, the first and the last always reachable, and gaps as ellipses. Thirty
 * pages wrap onto two rows at 375px and never scroll sideways, which is what bounds it.
 */
const PER_PAGE = 10

/** Page counts read better than item counts here, and the component takes reka's two numbers. */
function of(pageCount: number) {
  return { total: pageCount * PER_PAGE, itemsPerPage: PER_PAGE }
}

function strip(page: number, pageCount: number) {
  const wrapper = mount(ListPagination, { props: { page, ...of(pageCount) } })
  return wrapper
    .findAll('button, [data-slot="pagination-ellipsis"]')
    .map((element) =>
      element.attributes('data-slot') === 'pagination-ellipsis'
        ? '…'
        : element.text().trim() || element.attributes('aria-label'),
    )
}

describe('ListPagination', () => {
  it('renders nothing while everything fits one page', () => {
    expect(
      mount(ListPagination, { props: { page: 1, ...of(1) } })
        .find('nav')
        .exists(),
    ).toBe(false)
  })

  /** A part-full last page is still a second page — the boundary the hiding rule sits on. */
  it('appears as soon as one item does not fit', () => {
    const wrapper = mount(ListPagination, {
      props: { page: 1, total: PER_PAGE + 1, itemsPerPage: PER_PAGE },
    })
    expect(
      wrapper.findAll('button').map((b) => b.text().trim() || b.attributes('aria-label')),
    ).toEqual(['Zurück', '1', '2', 'Weiter'])
  })

  it('shows every page while they fit', () => {
    expect(strip(1, 6)).toEqual(['Zurück', '1', '2', '3', '4', '5', '6', 'Weiter'])
  })

  /** The constraint the component exists for: thirty pages still reachable from a phone. */
  it('keeps the first, the last and a neighbour either side over thirty pages', () => {
    expect(strip(15, 30)).toEqual(['Zurück', '1', '…', '14', '15', '16', '…', '30', 'Weiter'])
  })

  /**
   * Near an edge the run widens rather than narrowing, which the hand-written version did not do:
   * it kept a constant number of entries so the strip does not change width as somebody pages
   * through. Worth knowing, because it is the one behaviour that changed in adopting reka's.
   */
  it('keeps its width near the edges instead of shrinking', () => {
    expect(strip(1, 30)).toEqual(['Zurück', '1', '2', '3', '4', '5', '…', '30', 'Weiter'])
    expect(strip(29, 30)).toEqual(['Zurück', '1', '…', '26', '27', '28', '29', '30', 'Weiter'])
  })

  it('marks the current page for a screen reader, not only visually', () => {
    const wrapper = mount(ListPagination, { props: { page: 4, ...of(9) } })
    const current = wrapper.findAll('button').filter((b) => b.attributes('aria-current') === 'page')
    expect(current).toHaveLength(1)
    expect(current.at(0)?.text().trim()).toBe('4')
  })

  it('asks its caller to move, rather than moving itself', async () => {
    const wrapper = mount(ListPagination, { props: { page: 1, ...of(6) } })
    await wrapper
      .findAll('button')
      .find((b) => b.text().trim() === '3')
      ?.trigger('click')
    expect(wrapper.emitted('update:page')).toEqual([[3]])
  })

  /** „←" and „→" were the last unicode marks in `src/`; the fonts do not carry that class of glyph. */
  it('draws its arrows as icons', () => {
    const wrapper = mount(ListPagination, { props: { page: 2, ...of(6) } })
    expect(wrapper.text()).not.toMatch(/[←→]/u)
    expect(wrapper.findAll('svg').length).toBe(2)
  })
})
