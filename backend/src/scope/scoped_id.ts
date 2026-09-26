/**
 * An id a resolver in this directory found under its parent, visible to the member asking; a
 * service acting on a child takes only these. Only this directory, and tests, mint them.
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
