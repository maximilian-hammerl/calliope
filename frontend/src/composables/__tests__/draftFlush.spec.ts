import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import { updatePost } from '@/api/posts/posts'

/**
 * `useDraft`'s last save happens on `pagehide`, and it only arrives because the request is made
 * with `keepalive` — without it the browser cancels it as the page goes away and whatever was
 * typed after the previous autosave is lost.
 *
 * That flag reaches `fetch` by being passed to the *generated* function as a `RequestInit`. This
 * pins that path: it was a hand-written `fetch` for exactly this reason, which is also how it went
 * on sending a body the API had stopped accepting. If Orval ever stops forwarding options, the
 * flag disappears silently and drafts are lost only on tab close — the hardest kind of bug to
 * notice.
 */
describe('the draft flush', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reaches fetch with keepalive, through the generated function', async () => {
    const calls: RequestInit[] = []
    vi.stubGlobal('fetch', (_url: string, init: RequestInit) => {
      calls.push(init)
      return Promise.resolve(new Response('{}', { status: 200 }))
    })

    await updatePost(
      'a-group',
      'a-thread',
      'a-post',
      { document: { type: 'doc', content: [{ type: 'paragraph' }] } },
      { keepalive: true },
    )

    expect(calls).toHaveLength(1)
    expect(calls[0]?.keepalive).toBe(true)
    // The method and the body still come from the client, not from a hand-written call.
    expect(calls[0]?.method).toBe('PATCH')
    expect(JSON.parse(String(calls[0]?.body))).toHaveProperty('document')
  })

  it('will not compile a body the API stopped accepting', () => {
    type Body = Parameters<typeof updatePost>[3]

    // `text` was the body until the document replaced it, and a hand-written `fetch` went on
    // sending it because nothing checked. This is the check that hand-written call could not make.
    expectTypeOf<Body>().not.toHaveProperty('text')
    expectTypeOf<Body>().toHaveProperty('document')
  })
})
