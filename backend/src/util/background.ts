/**
 * Work a request starts but does not wait for: sending mail, which takes as long as the
 * remote server feels like taking, and anything whose duration would leak what the response
 * deliberately does not say. Inline, asking about a registered address measured 8ms against
 * 3ms for an unregistered one, with no overlap — an account oracle.
 *
 * The cost is that failures can only be logged, and tasks still running at shutdown are lost.
 */
const pending = new Set<Promise<void>>();

export function runInBackground(
  description: string,
  work: () => Promise<void>,
): void {
  const task = work()
    .catch((error: unknown) => {
      console.error(`${description} failed:`, error);
    })
    .finally(() => {
      pending.delete(task);
    });

  pending.add(task);
}

/**
 * Tests await this so an assertion does not race the work; nothing in the application calls
 * it. Loops because a background task can start another, which is not in the set yet when
 * the first `Promise.all` reads it.
 */
export async function flushBackgroundWork(): Promise<void> {
  while (pending.size > 0) {
    // deno-lint-ignore no-await-in-loop -- sequential on purpose, each round can add tasks
    await Promise.all(pending);
  }
}
