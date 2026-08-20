import type { Selectable } from "kysely";
import { db } from "@/src/database/client.ts";
import type { WritingGroupNextStep as DatabaseStep } from "@/src/database/schema.ts";

export type NextStep =
  & Pick<
    Selectable<DatabaseStep>,
    | "id"
    | "writingGroupId"
    | "text"
    | "createdBy"
    | "completedAt"
    | "completedBy"
    | "createdAt"
  >
  & { createdByUsername: string | null; completedByUsername: string | null };

const SELECTED_COLUMNS = [
  "writingGroupNextStep.id",
  "writingGroupNextStep.writingGroupId",
  "writingGroupNextStep.text",
  "writingGroupNextStep.createdBy",
  "writingGroupNextStep.completedAt",
  "writingGroupNextStep.completedBy",
  "writingGroupNextStep.createdAt",
] as const;

// Two joins to `user`, so both need aliases.
function stepsWithNames() {
  return db
    .selectFrom("writingGroupNextStep")
    .leftJoin("user as creator", "creator.id", "writingGroupNextStep.createdBy")
    .leftJoin(
      "user as completer",
      "completer.id",
      "writingGroupNextStep.completedBy",
    )
    .select([
      ...SELECTED_COLUMNS,
      "creator.username as createdByUsername",
      "completer.username as completedByUsername",
    ]);
}

/**
 * Open steps by age, then completed ones by completion — the order the rail shows them.
 * DESC puts NULLs first in Postgres, which is what leads with the open steps.
 */
async function listSteps(writingGroupId: string): Promise<NextStep[]> {
  return await stepsWithNames()
    .where("writingGroupNextStep.writingGroupId", "=", writingGroupId)
    .orderBy("writingGroupNextStep.completedAt", "desc")
    .orderBy("writingGroupNextStep.createdAt", "asc")
    .execute();
}

async function insertStep(
  writingGroupId: string,
  text: string,
  createdBy: string,
): Promise<NextStep> {
  const { id } = await db
    .insertInto("writingGroupNextStep")
    .values({ writingGroupId, text, createdBy })
    .returning("id")
    .executeTakeFirstOrThrow();

  return await stepsWithNames()
    .where("writingGroupNextStep.id", "=", id)
    .executeTakeFirstOrThrow();
}

/**
 * Idempotent in both directions, and the first completer wins: ticking an already-completed
 * step changes nothing, so two members ticking together do not overwrite each other.
 */
async function setCompleted(
  stepId: string,
  done: boolean,
  userId: string,
): Promise<NextStep | undefined> {
  await db
    .updateTable("writingGroupNextStep")
    .set(
      done
        ? {
          completedAt: Temporal.Now.instant().toString(),
          completedBy: userId,
        }
        : { completedAt: null, completedBy: null },
    )
    .where("id", "=", stepId)
    .$if(done, (qb) => qb.where("completedAt", "is", null))
    .execute();

  return await stepsWithNames()
    .where("writingGroupNextStep.id", "=", stepId)
    .executeTakeFirst();
}

async function selectStep(stepId: string): Promise<NextStep | undefined> {
  return await stepsWithNames()
    .where("writingGroupNextStep.id", "=", stepId)
    .executeTakeFirst();
}

async function deleteStep(stepId: string): Promise<boolean> {
  const result = await db
    .deleteFrom("writingGroupNextStep")
    .where("id", "=", stepId)
    .executeTakeFirst();

  return result.numDeletedRows > 0n;
}

export const WritingGroupNextStepService = {
  listSteps,
  insertStep,
  setCompleted,
  selectStep,
  deleteStep,
};
