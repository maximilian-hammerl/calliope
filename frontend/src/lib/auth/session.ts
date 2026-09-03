import { getGetCurrentUserQueryKey, getGetCurrentUserQueryOptions } from '@/api/auth/auth'
import type { GetCurrentUser200 } from '@/api/models'
import { ApiError } from '@/lib/api/apiFetch'
import { queryClient } from '@/lib/api/queryClient'

/**
 * The session cookie is httpOnly, so asking the API is the only way to find out whether this
 * browser is signed in. `ensureQueryData` reuses the cached answer, which keeps a navigation
 * between guarded routes from producing a request each time.
 *
 * Returns undefined when signed out; anything else (an outage, a rate limit) is rethrown so
 * it is not silently mistaken for a signed-out visitor.
 */
export async function fetchCurrentUser(): Promise<GetCurrentUser200 | undefined> {
  try {
    const response = await queryClient.ensureQueryData(getGetCurrentUserQueryOptions())
    // The generated type is a union over every declared status; the mutator throws on all
    // but the first, so this narrows what is already true at runtime.
    return response.status === 200 ? response.data : undefined
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return undefined
    }
    throw error
  }
}

/**
 * Drops the cached session so the next guard run has to ask the API again — and makes anything
 * already watching it ask too.
 *
 * `reset`, not `remove`: removing a query orphans its live observers, and `AppLayout` holds one
 * for the whole session now that the frame is mounted once. Signing in left the bars missing and
 * the signed-out footer showing until a reload, because the guard re-asked through
 * `ensureQueryData` while the frame's own observer sat on nothing. It never showed while each
 * page rendered its own `AppLayout`: navigating destroyed the observer and built a new one.
 */
export function forgetCurrentUser(): void {
  void queryClient.resetQueries({ queryKey: getGetCurrentUserQueryKey() })
}
