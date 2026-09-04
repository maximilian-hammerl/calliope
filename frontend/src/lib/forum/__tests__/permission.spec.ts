import { describe, expect, it } from 'vitest'
import { mayWriteInForum } from '../permission'

describe('mayWriteInForum', () => {
  it('lets a member write where the row grants it', () => {
    expect(mayWriteInForum('write', false)).toBe(true)
  })

  it('does not, where the row is read-only or hidden', () => {
    expect(mayWriteInForum('read', false)).toBe(false)
    expect(mayWriteInForum('hidden', false)).toBe(false)
  })

  /**
   * The bug this exists to stop: the permission a row carries is what *members* get, so asking it
   * alone left an operator unable to edit the forum's own rules page, which the API allows.
   */
  it('lets an operator write anywhere, whatever the row says', () => {
    expect(mayWriteInForum('read', true)).toBe(true)
    expect(mayWriteInForum('hidden', true)).toBe(true)
  })

  /** A group's rows carry no permission at all, and nothing in a group should ask this. */
  it('refuses a member when there is no permission to read', () => {
    expect(mayWriteInForum(undefined, false)).toBe(false)
  })
})
