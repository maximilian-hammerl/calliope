/**
 * Fails the type check when a union grows a member a `switch` does not handle, and says which
 * one at run time if it ever gets there anyway.
 *
 * Put it in the `default` branch: TypeScript only narrows the argument to `never` once every
 * case is covered, so adding a notification type — or a role, or a status — turns every switch
 * that forgot about it into a compile error instead of a quietly missing line.
 *
 * Duplicated in the backend (`util/assert_unreachable.ts`) because the two projects share no
 * code; the file is four lines, and a build-time dependency between them would cost more.
 */
export function assertUnreachable(value: never): never {
  throw new Error(`Case not handled: ${JSON.stringify(value)}`)
}
