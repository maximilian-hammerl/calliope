/**
 * `QUERY` is a read despite carrying a body — RFC 10008's point is that it fetches. Anything not
 * named here is a write, so a method added later is treated more carefully rather than less.
 */
export const READ_METHODS: ReadonlySet<string> = new Set([
  "GET",
  "HEAD",
  "QUERY",
]);

export function isReadMethod(method: string): boolean {
  return READ_METHODS.has(method);
}
