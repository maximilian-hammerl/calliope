import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import FolderTreeNode from '@/components/folder/FolderTreeNode.vue'
import type { TreeNode } from '@/lib/folder/buildTree'

const leaf = (id: string, title: string): TreeNode => ({
  kind: 'page',
  id,
  title,
  lastActivityAt: '2026-09-02T10:00:00.000000+00:00',
  isFavourite: false,
  createdBy: 'u',
  folderId: null,
})

const folder = (id: string, title: string, children: TreeNode[]): TreeNode => ({
  kind: 'folder',
  id,
  title,
  description: null,
  depth: 1,
  createdBy: 'u',
  children,
})

/**
 * The nesting is the whole point of the tree, and §27 of the requirements asks for semantic
 * HTML — so it has to be in the markup, not only in the indentation. A screen reader reads the
 * list structure; it cannot read a margin.
 */
describe('the tree renders its hierarchy as nested lists', () => {
  const stubs = {
    RouterLink: defineComponent({
      setup:
        (_, { slots }) =>
        () =>
          h('a', slots.default?.()),
    }),
    DropdownMenu: true,
    DropdownMenuTrigger: true,
    DropdownMenuContent: true,
    FavouriteMark: true,
  }

  it('puts each node in an li, and a folder’s children in a nested ul', () => {
    const wrapper = mount(FolderTreeNode, {
      props: {
        node: folder('f1', 'Weltenbau', [leaf('p1', 'Der Berg')]),
        groupId: 'g1',
        mayWrite: true,
        collapsed: new Set<string>(),
      },
      global: { stubs },
    })

    expect(wrapper.element.tagName).toBe('LI')
    const nested = wrapper.find('ul')
    expect(nested.exists()).toBe(true)
    expect(nested.find('li').exists()).toBe(true)
    expect(nested.text()).toContain('Der Berg')
  })

  it('puts a leaf in an li with no list of its own', () => {
    const wrapper = mount(FolderTreeNode, {
      props: {
        node: leaf('p1', 'Der Berg'),
        groupId: 'g1',
        mayWrite: true,
        collapsed: new Set<string>(),
      },
      global: { stubs },
    })

    expect(wrapper.element.tagName).toBe('LI')
    expect(wrapper.find('ul').exists()).toBe(false)
  })

  it('drops the nested list when the folder is collapsed', () => {
    const wrapper = mount(FolderTreeNode, {
      props: {
        node: folder('f1', 'Weltenbau', [leaf('p1', 'Der Berg')]),
        groupId: 'g1',
        mayWrite: true,
        collapsed: new Set(['f1']),
      },
      global: { stubs },
    })

    expect(wrapper.find('ul').exists()).toBe(false)
  })
})
