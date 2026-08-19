/**
 * The one error shape the API uses for every failure. Declared here rather than imported,
 * because Orval emits a separate copy of it per operation and status (`LoginUser401`,
 * `GetCurrentUser429`, …) with no shared type to refer to.
 */
export type ApiErrorBody = {
  error: string
  issues?: { path: string; message: string }[]
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
  ) {
    super(body.error ?? `Request failed with status ${status}`)
    this.name = 'ApiError'
  }
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
    throw new ApiError(response.status, data as ApiErrorBody)
  }

  return { data, status: response.status, headers: response.headers } as ApiResponse as T
}
