/**
 * An id that a resolver in this directory has found under its parent and visible to the member
 * asking. A service that acts on a child takes one of these rather than a string, so a handler
 * that never resolved the id does not compile. Minting is this directory's alone, and
 * `test/scope.ts`'s for tests that made their ids themselves — `lint/scoped_ids.ts` holds that.
 */
declare const SCOPE: unique symbol;

type Scoped<Kind extends string> = string & { readonly [SCOPE]: Kind };

export type GroupId = Scoped<"group">;
export type ThreadId = Scoped<"thread">;
export type PostId = Scoped<"post">;
export type PageId = Scoped<"page">;
export type FolderId = Scoped<"folder">;
export type StepId = Scoped<"step">;
/** A user id with a membership in the group — an invitation or a joined member. */
export type MemberId = Scoped<"member">;

/** A row as a resolver hands it on: the same row, its id scoped. */
export type Resolved<Row extends { id: string }, Id extends string> =
  & Omit<Row, "id">
  & { id: Id };

export function mint<Id extends Scoped<string>>(id: string): Id {
  return id as Id;
}

export function resolved<Row extends { id: string }, Id extends Scoped<string>>(
  row: Row,
): Resolved<Row, Id> {
  return { ...row, id: mint<Id>(row.id) };
}
