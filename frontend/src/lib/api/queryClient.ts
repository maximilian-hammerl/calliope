import { MutationCache, QueryCache, QueryClient } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import { getGetCurrentUserQueryKey } from '@/api/auth/auth'
import { LoginUser401Code } from '@/api/models'
import { ApiError } from './apiFetch'

/**
 * Whether the API answered at all, last time anything asked it. False during a deploy or a
 * restart, which the interface shows rather than letting every page fail on its own.
 *
 * This is the one place that already sees every query and every mutation, so it is where the
 * question is cheapest to answer honestly.
 */
export const backendReachable = ref<boolean>(true)

/**
 * Only the reverse proxy failing to reach the application counts. Caddy answers 502 when
 * nothing is listening on the backend — verified against a stopped container — and 504 when
 * it connects but gets no reply in time.
 *
 * Not every 5xx: a 500 or a 501 was produced by the application itself, which means it is
 * running and something in it went wrong. That is a different problem, it will not fix itself
 * by waiting, and dressing it up as "no connection" would hide a real fault behind a
 * reconnection notice. 503 is excluded for the same reason — here it comes from this API's own
 * health check reporting an unreachable database, not from the proxy.
 *
 * A rejected fetch has no status at all — nothing listening, DNS, TLS, the whole stack down —
 * and surfaces as a `TypeError`.
 */
const GATEWAY_FAILURE_STATUSES: ReadonlySet<number> = new Set([502, 504])

function isUnreachable(error: unknown): boolean {
  if (error instanceof ApiError) {
    return GATEWAY_FAILURE_STATUSES.has(error.status)
  }
  return error instanceof TypeError
}

export type RateLimitScope = 'read' | 'write'

/**
 * When each rate-limit budget lifts, as epoch milliseconds. Global for the reason
 * `backendReachable` is: a 429 is not one call site's problem, so a message beside one control
 * would leave the rest of the interface failing silently.
 *
 * **Two of them, because the backend has two.** Reads and writes are counted separately, so a
 * member who has spent one has not necessarily spent the other — and the two mean different
 * things: reads exhausted is an interface that cannot load anything, writes exhausted is one that
 * still reads perfectly and cannot save. Saying "the server is not answering" for the second would
 * be a lie told over a working page.
 *
 * Set from `Retry-After`, which the limiter sends and which counts down honestly. Without the
 * header there is still a limit to report, just no wait to name.
 */
export const rateLimitedUntil = ref<Partial<Record<RateLimitScope, number>>>({})

/** A limit reported without a wait, so the banner can still say what happened. */
const RATE_LIMIT_FALLBACK_MS = 60_000

function noteRateLimit(error: unknown): void {
  if (!(error instanceof ApiError) || error.status !== 429) {
    return
  }

  // The body says which budget refused it. Reading it off the request's own method would give the
  // same answer for a query or a mutation, but not for the draft's direct calls.
  const scope: RateLimitScope = error.body.scope ?? 'read'

  const until =
    Date.now() +
    (error.retryAfterSeconds === undefined
      ? RATE_LIMIT_FALLBACK_MS
      : error.retryAfterSeconds * 1000)

  // The furthest answer wins: two requests refused a minute apart report different waits, and the
  // later one is the one that has to pass.
  const known = rateLimitedUntil.value[scope]
  if (known === undefined || until > known) {
    rateLimitedUntil.value = { ...rateLimitedUntil.value, [scope]: until }
  }
}

/** Whether either budget is spent, which is what decides that the notice is on screen at all. */
export const rateLimited = computed<boolean>(
  () => rateLimitedUntil.value.read !== undefined || rateLimitedUntil.value.write !== undefined,
)

/** A budget is spent until something it governs succeeds again. */
function clearRateLimit(scope: RateLimitScope): void {
  if (rateLimitedUntil.value[scope] !== undefined) {
    rateLimitedUntil.value = { ...rateLimitedUntil.value, [scope]: undefined }
  }
}

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
 * A 401 has two meanings and only one of them should sign anybody out. The API says which:
 * a wrong password — signing in, or re-authenticating with a valid session — carries
 * `code: invalid_credentials`, and anything else is a session that has ended.
 *
 * Getting this wrong is not a small bug and it hides well. A wrong password read as a lost
 * session replaces the member onto the home page: dialog closed, whatever they typed gone. The
 * session itself survives, so it does not look like being signed out, and from the home page
 * the redirect lands where they already are and nothing appears to happen.
 *
 * The value comes from the generated client rather than a literal, so renaming it in the
 * backend breaks compilation here instead of behaviour.
 */
const INVALID_CREDENTIALS = LoginUser401Code.invalid_credentials

/**
 * Signing out is the one 401 that genuinely *is* a lost session and still must not be treated
 * as one: the session was already gone, which is exactly what was being asked for.
 */
const EXPECTED_401_MUTATIONS = new Set(['logoutUser'])

/**
 * The guard's own session check, which asks whether there is a session at all — a 401 is its
 * answer, not a failure. Taken from the generated client so a path change follows.
 *
 * Discriminating on the current route instead does not work: during a navigation the router
 * still reports the route being *left*, so the guard's 401 on the sign-in page looks like a
 * lost session and redirects to the page it is already on, which re-runs the guard. That loop
 * fired several hundred requests before the rate limiter stopped it.
 */
const SESSION_CHECK_KEY = JSON.stringify(getGetCurrentUserQueryKey())

function isExpected(error: ApiError, key: readonly unknown[] | undefined): boolean {
  if (error.body.code === INVALID_CREDENTIALS) {
    return true
  }
  if (key === undefined) {
    return false
  }
  return (
    JSON.stringify(key) === SESSION_CHECK_KEY ||
    (typeof key[0] === 'string' && EXPECTED_401_MUTATIONS.has(key[0]))
  )
}

function handleError(error: unknown, key: readonly unknown[] | undefined): void {
  backendReachable.value = !isUnreachable(error)
  noteRateLimit(error)

  if (error instanceof ApiError && error.status === 401 && !isExpected(error, key)) {
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
    // Any answer at all means the API is back, and that it is answering this client again.
    onSuccess: () => {
      backendReachable.value = true
      clearRateLimit('read')
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) =>
      handleError(error, mutation.options.mutationKey),
    onSuccess: () => {
      backendReachable.value = true
      clearRateLimit('write')
    },
  }),
  defaultOptions: {
    queries: {
      /**
       * Without this the default is 0, so every query is stale the instant it resolves and every
       * mount refetches it. Nothing was ever served from cache: walking between a group and one
       * of its threads cost ten requests each way, and one thread created or deleted cost more
       * than thirty — which spent a member's 500-read budget in eleven minutes of ordinary use.
       *
       * Correctness does not rest on this number. Every mutation invalidates what it changed, and
       * an invalidated query refetches whatever its age; the window only decides how long an
       * *unchanged* page may be re-shown without asking again.
       */
      staleTime: 30_000,
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
