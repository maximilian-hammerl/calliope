/**
 * The one error shape the API uses for every failure. Declared here rather than imported,
 * because Orval emits a separate copy of it per operation and status (`LoginUser401`,
 * `GetCurrentUser429`, …) with no shared type to refer to.
 */
export type ApiErrorBody = {
  error: string
  issues?: { path: string; message: string }[]
  /** Set only where a client has to act on the reason. See `queryClient`'s 401 handling. */
  code?: string
  /** Which of the two rate-limit budgets refused it, on a 429 and nowhere else. */
  scope?: 'read' | 'write'
}

/**
 * A response the API reported as a failure. Orval's generated fetch client resolves for
 * every status, which would make vue-query treat a 401 as a success, so the mutator below
 * throws this instead.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody,
    /**
     * Seconds until the request may be repeated, from `Retry-After`. Only the rate limiter sends
     * it — `standardHeaders: "draft-7"` — and it counts down within the window rather than
     * restating its length, so it can be shown as a real wait.
     */
    readonly retryAfterSeconds?: number,
  ) {
    super(body.error ?? `Request failed with status ${status}`)
    this.name = 'ApiError'
  }
}

/** Only a positive whole number of seconds is usable; the header is also allowed to be a date. */
function readRetryAfter(headers: Headers): number | undefined {
  const value = Number(headers.get('Retry-After'))
  return Number.isFinite(value) && value > 0 ? Math.ceil(value) : undefined
}

/** The shape Orval's generated functions expect back from the mutator. */
type ApiResponse = { data: unknown; status: number; headers: Headers }

/**
 * Replaces `fetch` in the generated client. URLs stay relative so the browser treats them
 * as same-origin — in development Vite proxies them to the backend, in production Caddy
 * serves both from one host. That is what lets the httpOnly session cookie be sent without
 * any credentials configuration.
 */
export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)

  // Mirrors the generated client: these statuses carry no body to parse.
  const body = [204, 205, 304].includes(response.status) ? null : await response.text()
  const data: unknown = body ? JSON.parse(body) : {}

  if (!response.ok) {
    throw new ApiError(response.status, data as ApiErrorBody, readRetryAfter(response.headers))
  }

  return { data, status: response.status, headers: response.headers } as ApiResponse as T
}
