import type { Selectable } from "kysely";
import { db } from "@/src/database/client.ts";
import type {
  StoryIdea as DatabaseStoryIdea,
  StoryIdeaPartySize,
  StoryIdeaReaderState,
  StoryIdeaStatus,
  StoryLanguage,
} from "@/src/database/schema.ts";
import { emptyToNull, normaliseTags } from "@/src/util/story_tags.ts";
import type { ListQuery, ListResults } from "@/src/list/list_endpoint_query.ts";
import {
  listResultsWithCount,
  searchPattern,
} from "@/src/list/list_endpoint_query.ts";

export type StoryIdea =
  & Pick<
    Selectable<DatabaseStoryIdea>,
    | "id"
    | "title"
    | "subtitle"
    | "idea"
    | "genres"
    | "subgenres"
    | "tropes"
    | "contentWarnings"
    | "tense"
    | "perspective"
    | "language"
    | "lookingFor"
    | "partySize"
    | "status"
    | "createdBy"
    | "createdAt"
  >
  // Never null: created_by is NOT NULL and CASCADE, so an idea cannot outlive its author.
  & { createdByUsername: string }
  // The reading member's own state, null while unread. Never anybody else's: what a member
  // has read is theirs, and a count of readers is the statistic the research rejected.
  & { readerState: StoryIdeaReaderState | null };

/** The board's default is `open`: what is still worth answering. */
export type StatusFilter = StoryIdeaStatus | "any";

/** `unread` is the absence of a row, which is why it is not a value of the enum itself. */
export type ReaderStateFilter = StoryIdeaReaderState | "unread" | "any";

const SELECTED_COLUMNS = [
  "storyIdea.id",
  "storyIdea.title",
  "storyIdea.subtitle",
  "storyIdea.idea",
  "storyIdea.genres",
  "storyIdea.subgenres",
  "storyIdea.tropes",
  "storyIdea.contentWarnings",
  "storyIdea.tense",
  "storyIdea.perspective",
  "storyIdea.language",
  "storyIdea.lookingFor",
  "storyIdea.partySize",
  "storyIdea.status",
  "storyIdea.createdBy",
  "storyIdea.createdAt",
] as const;

/** What a member may set. Title and the idea itself are the only requirements, per §8.1. */
export type StoryIdeaValues = {
  title: string;
  idea: string;
  subtitle?: string | null;
  genres?: string[];
  subgenres?: string[];
  tropes?: string[];
  contentWarnings?: string[];
  tense?: string | null;
  perspective?: string | null;
  language?: StoryLanguage;
  lookingFor?: string | null;
  partySize?: StoryIdeaPartySize | null;
  status?: StoryIdeaStatus;
};

/** The one place values become a row: normalisation cannot be skipped by a caller. */
function toRow(values: Partial<StoryIdeaValues>) {
  return {
    ...(values.title === undefined ? {} : { title: values.title.trim() }),
    ...(values.idea === undefined ? {} : { idea: values.idea.trim() }),
    ...(values.subtitle === undefined
      ? {}
      : { subtitle: emptyToNull(values.subtitle) }),
    ...(values.genres === undefined
      ? {}
      : { genres: normaliseTags(values.genres) }),
    ...(values.subgenres === undefined
      ? {}
      : { subgenres: normaliseTags(values.subgenres) }),
    ...(values.tropes === undefined
      ? {}
      : { tropes: normaliseTags(values.tropes) }),
    ...(values.contentWarnings === undefined
      ? {}
      : { contentWarnings: normaliseTags(values.contentWarnings) }),
    ...(values.tense === undefined ? {} : { tense: emptyToNull(values.tense) }),
    ...(values.perspective === undefined
      ? {}
      : { perspective: emptyToNull(values.perspective) }),
    ...(values.language === undefined ? {} : { language: values.language }),
    ...(values.lookingFor === undefined
      ? {}
      : { lookingFor: emptyToNull(values.lookingFor) }),
    ...(values.partySize === undefined ? {} : { partySize: values.partySize }),
    ...(values.status === undefined ? {} : { status: values.status }),
  };
}

/**
 * Left join on the reader, so an unread idea still comes back — with `readerState` null. The
 * join is bound to one member's id: no query here can see another member's state.
 */
function withAuthor(readerId: string) {
  return db
    .selectFrom("storyIdea")
    .innerJoin("user", "user.id", "storyIdea.createdBy")
    .leftJoin(
      "storyIdeaReader",
      (join) =>
        join
          .onRef("storyIdeaReader.storyIdeaId", "=", "storyIdea.id")
          .on("storyIdeaReader.userId", "=", readerId),
    )
    .select([
      ...SELECTED_COLUMNS,
      "user.username as createdByUsername",
      "storyIdeaReader.state as readerState",
    ]);
}

function listStoryIdeas(
  query: ListQuery & {
    /** Whose state to report, and to filter by. Always the requesting member. */
    readerId: string;
    readerState: ReaderStateFilter;
    status: StatusFilter;
    language?: StoryLanguage;
    /** Only the reader's own ideas — the view that manages, not the one that browses. */
    createdBy?: string;
    /** The browsing view's inverse: discovery never shows the reader their own ideas. */
    excludeCreatedBy?: string;
    /** Blocked in either direction: their ideas are not offered to this reader. */
    hiddenAuthorIds?: ReadonlyArray<string>;
  },
): Promise<ListResults<StoryIdea>> {
  return listResultsWithCount(
    withAuthor(query.readerId)
      .$if(query.createdBy !== undefined, (queryBuilder) =>
        // deno-lint-ignore no-non-null-assertion -- the `$if` above only runs this when it is set
        queryBuilder.where("storyIdea.createdBy", "=", query.createdBy!))
      .$if(
        (query.hiddenAuthorIds ?? []).length > 0,
        (queryBuilder) =>
          queryBuilder.where(
            "storyIdea.createdBy",
            "not in",
            query.hiddenAuthorIds ?? [],
          ),
      )
      .$if(
        query.excludeCreatedBy !== undefined,
        (queryBuilder) =>
          queryBuilder.where(
            "storyIdea.createdBy",
            "!=",
            // deno-lint-ignore no-non-null-assertion -- the `$if` above only runs this when it is set
            query.excludeCreatedBy!,
          ),
      )
      .$if(
        query.status !== "any",
        (queryBuilder) =>
          queryBuilder.where(
            "storyIdea.status",
            "=",
            query.status as StoryIdeaStatus,
          ),
      )
      .$if(query.language !== undefined, (queryBuilder) =>
        // deno-lint-ignore no-non-null-assertion -- the `$if` above only runs this when it is set
        queryBuilder.where("storyIdea.language", "=", query.language!))
      // Unread is the missing row, so it filters on the join rather than on a value.
      .$if(
        query.readerState === "unread",
        (queryBuilder) =>
          queryBuilder.where("storyIdeaReader.state", "is", null),
      )
      .$if(
        query.readerState === "read" || query.readerState === "marked",
        (queryBuilder) =>
          queryBuilder.where(
            "storyIdeaReader.state",
            "=",
            query.readerState as StoryIdeaReaderState,
          ),
      )
      .$if(
        query.search !== undefined,
        (queryBuilder) =>
          queryBuilder.where((eb) =>
            eb.or([
              // deno-lint-ignore no-non-null-assertion -- the `$if` above only runs this when the term is set
              eb("storyIdea.title", "ilike", searchPattern(query.search!)),
              // deno-lint-ignore no-non-null-assertion -- as above
              eb("storyIdea.idea", "ilike", searchPattern(query.search!)),
            ])
          ),
      ),
    query,
  );
}

async function selectStoryIdea(
  ideaId: string,
  readerId: string,
): Promise<StoryIdea | undefined> {
  return await withAuthor(readerId)
    .where("storyIdea.id", "=", ideaId)
    .executeTakeFirst();
}

async function insertStoryIdea(
  createdBy: string,
  values: StoryIdeaValues,
): Promise<StoryIdea> {
  const { id } = await db
    .insertInto("storyIdea")
    // title and idea restated so the type carries their presence; `toRow` describes a
    // change, where every field may be absent.
    .values({
      ...toRow(values),
      title: values.title.trim(),
      idea: values.idea.trim(),
      createdBy,
    })
    .returning("id")
    .executeTakeFirstOrThrow();

  // The author is the reader here, so a freshly created idea reports its own state: null.
  return await withAuthor(createdBy)
    .where("storyIdea.id", "=", id)
    .executeTakeFirstOrThrow();
}

/** Only the author's own rows match, so ownership and existence are one query. */
async function updateStoryIdea(
  ideaId: string,
  createdBy: string,
  values: Partial<StoryIdeaValues>,
): Promise<StoryIdea | undefined> {
  const updated = await db
    .updateTable("storyIdea")
    .set(toRow(values))
    .where("id", "=", ideaId)
    .where("createdBy", "=", createdBy)
    .returning("id")
    .executeTakeFirst();

  if (updated === undefined) {
    return undefined;
  }

  // Only the author can reach this, so they are the reader whose state comes back.
  return await selectStoryIdea(updated.id, createdBy);
}

async function deleteStoryIdea(
  ideaId: string,
  createdBy: string,
): Promise<boolean> {
  const deletion = await db
    .deleteFrom("storyIdea")
    .where("id", "=", ideaId)
    .where("createdBy", "=", createdBy)
    .executeTakeFirst();

  return deletion.numDeletedRows > 0n;
}

/**
 * Upsert, because a member setting a state twice is not an error: the second one wins and the
 * first row is simply overwritten.
 */
async function setReaderState(
  ideaId: string,
  userId: string,
  state: StoryIdeaReaderState,
): Promise<void> {
  await db
    .insertInto("storyIdeaReader")
    .values({ storyIdeaId: ideaId, userId, state })
    .onConflict((conflict) =>
      conflict
        .columns(["storyIdeaId", "userId"])
        .doUpdateSet({ state })
    )
    .execute();
}

/** Back to unread, which is the absence of a row rather than a third value. */
async function clearReaderState(
  ideaId: string,
  userId: string,
): Promise<void> {
  await db
    .deleteFrom("storyIdeaReader")
    .where("storyIdeaId", "=", ideaId)
    .where("userId", "=", userId)
    .execute();
}

export const StoryIdeaService = {
  listStoryIdeas,
  selectStoryIdea,
  setReaderState,
  clearReaderState,
  insertStoryIdea,
  updateStoryIdea,
  deleteStoryIdea,
};
