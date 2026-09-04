import type { Selectable } from "kysely";
import { db } from "@/src/database/client.ts";
import type {
  StoryIdea as DatabaseStoryIdea,
  StoryIdeaStatus,
  StoryLanguage,
} from "@/src/database/schema.ts";
import { emptyToNull } from "@/src/util/optional_text.ts";
import { refuseOrphanedSubgenres } from "@/src/http/story_metadata_refusal.ts";
import type { ListQuery, ListResults } from "@/src/list/list_endpoint_query.ts";
import {
  listResultsWithCount,
  searchPattern,
} from "@/src/list/list_endpoint_query.ts";
import type { StoryVocabularyFilter } from "@/src/query/story_vocabulary.ts";
import { withStoryVocabulary } from "@/src/query/story_vocabulary.ts";
import {
  type FavouriteFilter,
  FAVOURITES_FIRST,
  withFavourite,
} from "@/src/query/favourite.ts";

export type StoryIdea =
  & Pick<
    Selectable<DatabaseStoryIdea>,
    | "id"
    | "title"
    | "subtitle"
    | "teaser"
    | "synopsis"
    | "genres"
    | "subgenres"
    | "tropes"
    | "contentWarnings"
    | "storyThemes"
    | "storySettings"
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
  & {
    isRead: boolean;
    /** The reader's own favourite, visible to nobody else. */
    isFavourite: boolean;
  };

/** The board's default is `open`: what is still worth answering. */
export type StatusFilter = StoryIdeaStatus | "any";

/**
 * `unread` is the absence of a row, which is why it is not a value of the enum itself. `marked`
 * was a third value here until favouriting became its own thing across five kinds.
 */
export type ReaderStateFilter = "read" | "unread" | "any";

const SELECTED_COLUMNS = [
  "storyIdea.id",
  "storyIdea.title",
  "storyIdea.subtitle",
  "storyIdea.teaser",
  "storyIdea.synopsis",
  "storyIdea.genres",
  "storyIdea.subgenres",
  "storyIdea.tropes",
  "storyIdea.contentWarnings",
  "storyIdea.storyThemes",
  "storyIdea.storySettings",
  "storyIdea.tense",
  "storyIdea.perspective",
  "storyIdea.language",
  "storyIdea.lookingFor",
  "storyIdea.partySize",
  "storyIdea.status",
  "storyIdea.createdBy",
  "storyIdea.createdAt",
] as const;

/** What a member may set. Only the title and the two texts are required; see the request body. */
export type StoryIdeaValues =
  & Pick<Selectable<DatabaseStoryIdea>, "title" | "teaser" | "synopsis">
  & Partial<
    Pick<
      Selectable<DatabaseStoryIdea>,
      | "subtitle"
      | "genres"
      | "subgenres"
      | "tropes"
      | "contentWarnings"
      | "storyThemes"
      | "storySettings"
      | "tense"
      | "perspective"
      | "language"
      | "lookingFor"
      | "partySize"
      | "status"
    >
  >;

/** The one place values become a row: normalisation cannot be skipped by a caller. */
function toRow(values: Partial<StoryIdeaValues>) {
  return {
    ...(values.title === undefined ? {} : { title: values.title.trim() }),
    ...(values.teaser === undefined ? {} : { teaser: values.teaser.trim() }),
    ...(values.synopsis === undefined
      ? {}
      : { synopsis: values.synopsis.trim() }),
    ...(values.subtitle === undefined
      ? {}
      : { subtitle: emptyToNull(values.subtitle) }),
    ...(values.genres === undefined ? {} : { genres: values.genres }),
    ...(values.subgenres === undefined ? {} : { subgenres: values.subgenres }),
    ...(values.tropes === undefined ? {} : { tropes: values.tropes }),
    ...(values.contentWarnings === undefined
      ? {}
      : { contentWarnings: values.contentWarnings }),
    ...(values.storyThemes === undefined
      ? {}
      : { storyThemes: emptyToNull(values.storyThemes) }),
    ...(values.storySettings === undefined
      ? {}
      : { storySettings: emptyToNull(values.storySettings) }),
    ...(values.tense === undefined ? {} : { tense: values.tense ?? null }),
    ...(values.perspective === undefined
      ? {}
      : { perspective: values.perspective ?? null }),
    ...(values.language === undefined ? {} : { language: values.language }),
    ...(values.lookingFor === undefined
      ? {}
      : { lookingFor: emptyToNull(values.lookingFor) }),
    ...(values.partySize === undefined ? {} : { partySize: values.partySize }),
    ...(values.status === undefined ? {} : { status: values.status }),
  };
}

/**
 * Left join on the reader, so an unread idea still comes back — with `isRead` false. The join is
 * bound to one member's id: no query here can see another member's state.
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
    .$call((builder) =>
      withFavourite(builder, "story_idea", "storyIdea.id", readerId)
    )
    .select((eb) => [
      ...SELECTED_COLUMNS,
      "user.username as createdByUsername",
      // `$castTo` for the reason `report`'s `targetExists` needs it: `IS NOT NULL` already *is*
      // a boolean in Postgres, and only Kysely's type needs correcting.
      eb("storyIdeaReader.userId", "is not", null).$castTo<boolean>().as(
        "isRead",
      ),
    ]);
}

export type StoryIdeaFilters = StoryVocabularyFilter & {
  /** Whose state to report, and to filter by. Always the requesting member. */
  readerId: string;
  readerState: ReaderStateFilter;
  favourite: FavouriteFilter;
  status: StatusFilter;
  language?: StoryLanguage;
  /** Only the reader's own ideas — the view that manages, not the one that browses. */
  createdBy?: string;
  /** The browsing view's inverse: discovery never shows the reader their own ideas. */
  excludeCreatedBy?: string;
  /** Blocked in either direction: their ideas are not offered to this reader. */
  hiddenAuthorIds?: ReadonlyArray<string>;
  search?: string;
  /** One idea, still through every filter: how the carousel checks its anchor belongs. */
  id?: string;
  /** The carousel's bounds. Ids are uuidv7, so comparing them is creation order. */
  olderThanId?: string;
  newerThanId?: string;
};

/**
 * Every filter in one place, because the board and the carousel have to agree on what the set
 * is. A neighbour the carousel offers but the board would hide is an idea nobody can reach
 * twice.
 */
function filtered(query: StoryIdeaFilters) {
  // The carousel shares this chain and passes no vocabulary, so nothing here narrows its set —
  // which is what keeps "a neighbour the board would hide" from becoming reachable.
  return withStoryVocabulary(withAuthor(query.readerId), "storyIdea", query)
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
    // Unread is the missing row, so both directions filter on the join rather than on a value.
    .$if(
      query.readerState === "unread",
      (queryBuilder) =>
        queryBuilder.where("storyIdeaReader.userId", "is", null),
    )
    .$if(
      query.readerState === "read",
      (queryBuilder) =>
        queryBuilder.where("storyIdeaReader.userId", "is not", null),
    )
    .$if(
      query.favourite === "only",
      (queryBuilder) => queryBuilder.where("favourite.id", "is not", null),
    )
    .$if(
      query.search !== undefined,
      (queryBuilder) =>
        queryBuilder.where((eb) =>
          eb.or([
            // deno-lint-ignore no-non-null-assertion -- the `$if` above only runs this when the term is set
            eb("storyIdea.title", "ilike", searchPattern(query.search!)),
            // deno-lint-ignore no-non-null-assertion -- as above
            eb("storyIdea.teaser", "ilike", searchPattern(query.search!)),
            // deno-lint-ignore no-non-null-assertion -- as above
            eb("storyIdea.synopsis", "ilike", searchPattern(query.search!)),
          ])
        ),
    )
    .$if(query.id !== undefined, (queryBuilder) =>
      // deno-lint-ignore no-non-null-assertion -- the `$if` above only runs this when it is set
      queryBuilder.where("storyIdea.id", "=", query.id!))
    .$if(query.olderThanId !== undefined, (queryBuilder) =>
      // deno-lint-ignore no-non-null-assertion -- as above
      queryBuilder.where("storyIdea.id", "<", query.olderThanId!))
    .$if(query.newerThanId !== undefined, (queryBuilder) =>
      // deno-lint-ignore no-non-null-assertion -- as above
      queryBuilder.where("storyIdea.id", ">", query.newerThanId!));
}

function listStoryIdeas(
  query: ListQuery & StoryIdeaFilters,
): Promise<ListResults<StoryIdea>> {
  return listResultsWithCount(filtered(query), query, FAVOURITES_FIRST);
}
/**
 * Whether the idea exists and who wrote it — which is all five of the callers that use this as a
 * gate need, and none of them needs the prose. An idea carries a teaser and a synopsis running to
 * ten thousand characters between them, and it takes no reader join at all: whether *this* member
 * has read or favourited it has nothing to do with whether they may act on it.
 *
 * `title` is here because it is small and because it is the excerpt `resolveVisibleTarget` needs
 * for a reported idea. The page that renders an idea asks `selectStoryIdea` instead.
 */
export type StoryIdeaGate = {
  id: string;
  title: string;
  createdBy: string;
  status: StoryIdeaStatus;
};

async function selectStoryIdeaGate(
  ideaId: string,
): Promise<StoryIdeaGate | undefined> {
  return await db
    .selectFrom("storyIdea")
    .select([
      "storyIdea.id",
      "storyIdea.title",
      "storyIdea.createdBy",
      "storyIdea.status",
    ])
    .where("storyIdea.id", "=", ideaId)
    .executeTakeFirst();
}

/** The whole idea as this reader sees it, read state and favourite included. */
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
  refuseOrphanedSubgenres(values.genres ?? [], values.subgenres ?? []);

  const { id } = await db
    .insertInto("storyIdea")
    // title and both texts restated so the type carries their presence; `toRow` describes a
    // change, where every field may be absent.
    .values({
      ...toRow(values),
      title: values.title.trim(),
      teaser: values.teaser.trim(),
      synopsis: values.synopsis.trim(),
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
  // One transaction, as the group's update is: read apart from the write, two PATCHes racing can
  // each see a state its own change is consistent with — one setting the genres, the other the
  // subgenres — and both commit, leaving exactly the pair this refuses.
  const updated = await db.transaction().execute(async (transaction) => {
    // Scoped to the author like the update itself, so a stranger's idea cannot be reported on.
    // Against the resulting row rather than the request: see `refuseOrphanedSubgenres`.
    const before = await transaction
      .selectFrom("storyIdea")
      .select(["genres", "subgenres"])
      .where("id", "=", ideaId)
      .where("createdBy", "=", createdBy)
      .forUpdate()
      .executeTakeFirst();

    if (before !== undefined) {
      refuseOrphanedSubgenres(
        values.genres ?? before.genres,
        values.subgenres ?? before.subgenres,
      );
    }

    return await transaction
      .updateTable("storyIdea")
      .set(toRow(values))
      .where("id", "=", ideaId)
      .where("createdBy", "=", createdBy)
      .returning("id")
      .executeTakeFirst();
  });

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
async function markRead(ideaId: string, userId: string): Promise<void> {
  await db
    .insertInto("storyIdeaReader")
    .values({ storyIdeaId: ideaId, userId })
    // A row is the whole of the fact, so a second click has nothing to overwrite — but it must
    // not fail either, and marking read is the one action that fires without being asked for.
    .onConflict((conflict) =>
      conflict.columns(["storyIdeaId", "userId"]).doNothing()
    )
    .execute();
}

/** Back to unread, which is the absence of a row rather than a value. */
async function clearRead(
  ideaId: string,
  userId: string,
): Promise<void> {
  await db
    .deleteFrom("storyIdeaReader")
    .where("storyIdeaId", "=", ideaId)
    .where("userId", "=", userId)
    .execute();
}

export type StoryIdeaCarousel = {
  previous: StoryIdea | null;
  storyIdea: StoryIdea | null;
  next: StoryIdea | null;
  total: number;
};

/**
 * One step of the carousel: the idea to show and the two either side of it, whole rather than
 * as ids so the movement always has something to move to. `null` on a side is the end of the
 * set, which is where the carousel stops rather than wrapping.
 *
 * Neighbours are found by id, never by position. Ids are uuidv7, so comparing them is creation
 * order, and somebody posting an idea meanwhile cannot move anybody else's place — which an
 * offset would.
 *
 * `undefined` means the anchor is not part of the set. An empty set is not that: it answers
 * with nulls and a total of zero, a member who has read everything rather than an error.
 */
async function selectCarousel(
  readerId: string,
  hiddenAuthorIds: ReadonlyArray<string>,
  anchorId?: string,
): Promise<StoryIdeaCarousel | undefined> {
  // Fixed rather than passed in: the carousel is one set, so it takes no filters.
  const set = {
    readerId,
    hiddenAuthorIds,
    excludeCreatedBy: readerId,
    status: "open" as const,
    readerState: "unread" as const,
    favourite: "any" as const,
  };

  // Counts the whole set, and its single row is where a carousel opened without an anchor
  // starts.
  const newest = await listStoryIdeas({
    ...set,
    limit: 1,
    offset: 0,
    sort: [{ attribute: "storyIdea.id", order: "desc" }],
  });

  // Read state is ignored for the anchor alone: marking the idea on screen as read must not
  // invalidate the URL the member is sitting on. Every other part of the set still holds.
  const anchor = anchorId === undefined ? undefined : await filtered({
    ...set,
    readerState: "any",
    favourite: "any",
    id: anchorId,
  }).executeTakeFirst();

  if (anchorId !== undefined && anchor === undefined) {
    return undefined;
  }

  const storyIdea = anchor ?? newest.results[0];

  if (storyIdea === undefined) {
    return { previous: null, storyIdea: null, next: null, total: 0 };
  }

  const [previous, next] = await Promise.all([
    // Nothing precedes the newest, so an unanchored walk does not ask. Asking would read a
    // second statement's snapshot, where an idea posted since is suddenly the previous one —
    // which made the carousel's opening step nondeterministic.
    // Newest first, so the previous idea is the nearest one *above* this id.
    anchorId === undefined
      ? undefined
      : filtered({ ...set, newerThanId: storyIdea.id })
        .orderBy("storyIdea.id", "asc")
        .limit(1)
        .executeTakeFirst(),
    filtered({ ...set, olderThanId: storyIdea.id })
      .orderBy("storyIdea.id", "desc")
      .limit(1)
      .executeTakeFirst(),
  ]);

  return {
    previous: previous ?? null,
    storyIdea,
    next: next ?? null,
    total: newest.totalResults,
  };
}

export const StoryIdeaService = {
  listStoryIdeas,
  selectCarousel,
  selectStoryIdea,
  selectStoryIdeaGate,
  markRead,
  clearRead,
  insertStoryIdea,
  updateStoryIdea,
  deleteStoryIdea,
};
