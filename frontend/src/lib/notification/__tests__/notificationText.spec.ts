import { describe, expect, it } from 'vitest'
import { notificationAction, notificationText } from '@/lib/notification/notificationText'
import type { ListNotifications200ResultsItem } from '@/api/models'

/**
 * The three activity sentences were checked by nothing: the seed only creates invitation
 * notifications, so none of them appears in development, and no test read them. Their wording is
 * the whole of what a member sees, and each names a different subject — a thread, a thread the
 * post is in, a page — so getting one wrong is invisible until somebody reports it.
 */
const base = {
  id: 'n1',
  occurredAt: '2026-09-02T10:00:00.000000+00:00',
  readAt: null,
  actorUsername: 'federkiel',
  writingGroupId: 'g1',
  writingGroupTitle: 'Der Zauberzwerg',
} as const

const notification = (rest: Record<string, unknown>) =>
  ({ ...base, ...rest }) as unknown as ListNotifications200ResultsItem

describe('notificationText', () => {
  it('names a new thread and its group', () => {
    expect(
      notificationText(
        notification({
          type: 'new_writing_thread',
          writingThreadId: 't1',
          writingThreadTitle: 'Ankunft',
        }),
      ),
    ).toBe('federkiel hat das Thema „Ankunft“ in „Der Zauberzwerg“ angelegt.')
  })

  it('names both the thread and the group for a post, since a title alone places nothing', () => {
    expect(
      notificationText(
        notification({
          type: 'new_writing_post',
          writingThreadId: 't1',
          writingThreadTitle: 'Ankunft',
          writingPostId: 'p1',
        }),
      ),
    ).toBe('federkiel hat in „Ankunft“ in „Der Zauberzwerg“ geschrieben.')
  })

  it('names a new page as a Seite, not a Thema', () => {
    expect(
      notificationText(
        notification({
          type: 'new_writing_page',
          writingPageId: 'pg1',
          writingPageTitle: 'Die Bergstadt',
        }),
      ),
    ).toBe('federkiel hat die Seite „Die Bergstadt“ in „Der Zauberzwerg“ angelegt.')
  })

  it('says who it was even when the account is gone', () => {
    const text = notificationText(
      notification({
        type: 'new_writing_page',
        actorUsername: null,
        writingPageId: 'pg1',
        writingPageTitle: 'Die Bergstadt',
      }),
    )

    expect(text).toContain('Die Bergstadt')
    expect(text).not.toContain('null')
  })
})

describe('notificationAction', () => {
  it('takes a thread notification to the thread', () => {
    expect(
      notificationAction(
        notification({
          type: 'new_writing_thread',
          writingThreadId: 't1',
          writingThreadTitle: 'Ankunft',
        }),
      ),
    ).toEqual({ kind: 'route', to: { name: 'thread', params: { groupId: 'g1', threadId: 't1' } } })
  })

  it('takes a page notification to the page, not to its group', () => {
    expect(
      notificationAction(
        notification({
          type: 'new_writing_page',
          writingPageId: 'pg1',
          writingPageTitle: 'Die Bergstadt',
        }),
      ),
    ).toEqual({ kind: 'route', to: { name: 'page', params: { groupId: 'g1', pageId: 'pg1' } } })
  })

  it('takes a post notification to the thread it is in', () => {
    expect(
      notificationAction(
        notification({
          type: 'new_writing_post',
          writingThreadId: 't1',
          writingThreadTitle: 'Ankunft',
          writingPostId: 'p1',
        }),
      ),
    ).toEqual({ kind: 'route', to: { name: 'thread', params: { groupId: 'g1', threadId: 't1' } } })
  })
})
