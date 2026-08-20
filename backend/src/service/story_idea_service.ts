import type { Selectable } from "kysely";
import { db } from "@/src/database/client.ts";
import type {
  StoryIdea as DatabaseStoryIdea,
  StoryIdeaPartySize,
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
  & { createdByUsername: string };

/** The board's default is `open`: what is still worth answering. */
export type StatusFilter = StoryIdeaStatus | "any";

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

function withAuthor() {
  return db
    .selectFrom("storyIdea")
    .innerJoin("user", "user.id", "storyIdea.createdBy")
    .select([...SELECTED_COLUMNS, "user.username as createdByUsername"]);
}

function listStoryIdeas(
  query: ListQuery & {
    status: StatusFilter;
    language?: StoryLanguage;
    /** Only the reader's own ideas — the view that manages, not the one that browses. */
    createdBy?: string;
  },
): Promise<ListResults<StoryIdea>> {
  return listResultsWithCount(
    withAuthor()
      .$if(query.createdBy !== undefined, (queryBuilder) =>
        // deno-lint-ignore no-non-null-assertion -- the `$if` above only runs this when it is set
        queryBuilder.where("storyIdea.createdBy", "=", query.createdBy!))
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

async function selectStoryIdea(ideaId: string): Promise<StoryIdea | undefined> {
  return await withAuthor()
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

  return await withAuthor()
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

  return await selectStoryIdea(updated.id);
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

export const StoryIdeaService = {
  listStoryIdeas,
  selectStoryIdea,
  insertStoryIdea,
  updateStoryIdea,
  deleteStoryIdea,
};
