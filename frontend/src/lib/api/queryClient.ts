import { MutationCache, QueryCache, QueryClient } from '@tanstack/vue-query'
import { getGetCurrentUserQueryKey } from '@/api/auth/auth'
import { ApiError } from './apiFetch'

/**
 * Called when a request comes back 401 that was not *asking* whether there is a session,
 * which means the session ended while the page was open — expired, or signed out in another
 * tab. The router guard only runs on navigation, so without this a reader just sees a page
 * quietly stop working.
 *
 * Assigned by the router rather than imported, because the router imports this module.
 */
let onSessionLost: (() => void) | undefined

export function setSessionLostHandler(handler: () => void): void {
  onSessionLost = handler
}

/**
 * Operations whose 401 is an answer rather than a failure: signing in, registering, signing
 * out, re-authenticating to change an address, and the guard's own session check.
 *
 * Leaving one out is not a small bug. A wrong password at `requestEmailAddressChange` came back 401,
 * was read as a lost session, and signed the member out mid-form.
 *
 * Discriminating on the current route instead does not work — during a navigation the router
 * still reports the route being *left*, so the guard's 401 on the sign-in page looks like a
 * lost session and redirects to the page it is already on, which re-runs the guard. That loop
 * fired several hundred requests before the rate limiter stopped it.
 */
const EXPECTED_401_MUTATIONS = new Set([
  'loginUser',
  'registerUser',
  'logoutUser',
  'requestEmailAddressChange',
])

/** Taken from the generated client rather than written out, so a path change follows. */
const SESSION_CHECK_KEY = JSON.stringify(getGetCurrentUserQueryKey())

function isExpected(key: readonly unknown[] | undefined): boolean {
  if (key === undefined) {
    return false
  }
  return (
    JSON.stringify(key) === SESSION_CHECK_KEY ||
    (typeof key[0] === 'string' && EXPECTED_401_MUTATIONS.has(key[0]))
  )
}

function handleError(error: unknown, key: readonly unknown[] | undefined): void {
  if (error instanceof ApiError && error.status === 401 && !isExpected(key)) {
    onSessionLost?.()
  }
}

/**
 * Shared instance rather than the one the plugin would create, so the router guard can read
 * and prime the cache before a component exists to do it.
 */
export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => handleError(error, query.queryKey),
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) =>
      handleError(error, mutation.options.mutationKey),
  }),
  defaultOptions: {
    queries: {
      // Retrying a 401 or a 429 cannot succeed and, in the rate limiter's case, makes the
      // situation worse. Only genuine transport failures are worth a second attempt.
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status < 500) {
          return false
        }
        return failureCount < 2
      },
    },
  },
})
