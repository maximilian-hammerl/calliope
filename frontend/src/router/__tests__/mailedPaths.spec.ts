import { describe, expect, it } from 'vitest'
import { createRouter, createWebHistory } from 'vue-router'
import { routes } from '../routes'

/**
 * Every path the backend puts in a mailed link. They are written out here rather than
 * imported, because the two projects share no code — this list *is* the assertion, and it
 * has to be changed deliberately on both sides.
 *
 * The reason it exists: the address-change mails pointed at `/confirm-email-change` while the
 * router only had `/confirm-email-address-change`, so every link opened a blank page. Nothing
 * failed; the feature simply did not work. Paths live in
 * `backend/src/service/*_service.ts`.
 */
const MAILED_PATHS = [
  '/reset-password',
  '/verify-email-address',
  '/confirm-email-address-change',
  '/cancel-email-address-change',
  '/confirm-account-deletion',
]

describe('mailed link paths', () => {
  const router = createRouter({ history: createWebHistory(), routes })

  for (const path of MAILED_PATHS) {
    it(`${path} resolves to a route`, () => {
      expect(router.resolve(`${path}?token=t`).matched).not.toHaveLength(0)
    })

    // Followed from a mailbox, so on a device that is very likely not signed in.
    it(`${path} opens without a session`, () => {
      expect(router.resolve(path).meta.access).toBe('anyone')
    })
  }
})
