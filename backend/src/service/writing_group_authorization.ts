import type { UserInWritingGroupRole } from "@/src/database/schema.ts";

/**
 * Who may do what inside a writing group, as one table.
 *
 * There are two rules and the table says which applies where, so a route names the act it is
 * performing rather than choosing between helpers that look interchangeable:
 *
 * - **`writer`** — any writer or administrator. For making something, and for changing what the
 *   group *keeps*: its structure and its reference material. Holding those to whoever typed them
 *   first would stop the group maintaining its own material.
 * - **`author`** — its author, or an administrator, *and* only while they may write at all. For
 *   writing that *belongs* to somebody: a thread, a post, and the removal of a step somebody
 *   wrote down.
 *
 * The write check inside the author rule is what makes **demotion a containment measure**: moving
 * a member to reader freezes what they already wrote as well as stopping anything new. Without
 * it, an administrator who suspects an account is compromised could stop it writing but not stop
 * it deleting everything it had written — and demoting is the one such step an ordinary group can
 * take without an operator.
 *
 * Ticking a step is `writer` while deleting one is `author`, which is the one place the rule
 * turns on the operation rather than the kind. That is deliberate: whoever writes the chapter
 * ticks the box, and requiring the member who noted „Kapitel 2 anlegen" to be the one who marks
 * it done would make the list unusable — `steps_test.ts` has an administrator write a step and a
 * writer complete it. Deleting is the act that removes somebody's note from the group's plan.
 *
 * Adding a kind means adding its rows here, which is the point: the decision is made in one
 * readable place instead of being discovered in a route.
 */
const RULE = {
  "thread:create": "writer",
  "thread:change": "author",
  "thread:move": "author",
  "thread:delete": "author",

  "post:create": "writer",
  "post:change": "author",
  "post:delete": "author",

  "page:create": "writer",
  "page:change": "writer",
  "page:move": "writer",
  "page:delete": "writer",

  "folder:create": "writer",
  "folder:change": "writer",
  "folder:move": "writer",
  "folder:delete": "writer",

  "step:create": "writer",
  "step:tick": "writer",
  "step:delete": "author",
} as const satisfies Record<string, "writer" | "author">;

/** Not exported: a caller names an act with a literal, and the overloads check it. */
type Act = keyof typeof RULE;

/** The acts the author rule governs, derived from the table so the two cannot disagree. */
type AuthorAct = {
  [K in Act]: typeof RULE[K] extends "author" ? K : never;
}[Act];
type WriterAct = Exclude<Act, AuthorAct>;

/** Who wrote the thing, and who is asking. Null once the author's account is gone. */
type Content = { createdBy: string | null; userId: string };

const isWriter = (role: UserInWritingGroupRole): boolean =>
  role === "writer" || role === "administrator";

/**
 * Whether this role may perform this act. Two overloads rather than an optional argument: an
 * `author` act cannot be asked without the content it is about, and a `writer` act cannot be
 * handed content it would ignore.
 *
 * `createdBy` is null once that account is gone, and `null` never equals a user id — so writing
 * whose author has left is left to the administrators.
 */
export function mayAct(role: UserInWritingGroupRole, act: WriterAct): boolean;
export function mayAct(
  role: UserInWritingGroupRole,
  act: AuthorAct,
  content: Content,
): boolean;
export function mayAct(
  role: UserInWritingGroupRole,
  act: Act,
  content?: Content,
): boolean {
  if (RULE[act] === "writer") {
    return isWriter(role);
  }

  if (content === undefined) {
    // Unreachable through the overloads above, which is what makes this a bug rather than a case.
    throw new Error(`${act} is decided by its author, so it needs the content`);
  }

  // A reader changes nothing, not even their own: see the note on demotion above.
  if (!isWriter(role)) {
    return false;
  }

  return role === "administrator" || content.createdBy === content.userId;
}
