import { QueryClient } from '@tanstack/vue-query'
import { ApiError } from './api_fetch'

/**
 * Shared instance rather than the one the plugin would create, so the router guard can read
 * and prime the cache before a component exists to do it.
 */
export const queryClient = new QueryClient({
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
