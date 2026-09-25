import type { GroupId, StepId } from "@/src/scope/scoped_id.ts";
import type { Selectable } from "kysely";
import { db, type Transaction } from "@/src/database/client.ts";
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
function stepsWithNames(executor: typeof db | Transaction = db) {
  return executor
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
async function listSteps(writingGroupId: GroupId): Promise<NextStep[]> {
  return await stepsWithNames()
    .where("writingGroupNextStep.writingGroupId", "=", writingGroupId)
    .orderBy("writingGroupNextStep.completedAt", "desc")
    .orderBy("writingGroupNextStep.createdAt", "asc")
    .execute();
}

async function insertStep(
  transaction: Transaction,
  writingGroupId: GroupId,
  text: string,
  createdBy: string,
): Promise<NextStep> {
  const { id } = await transaction
    .insertInto("writingGroupNextStep")
    .values({ writingGroupId, text, createdBy })
    .returning("id")
    .executeTakeFirstOrThrow();

  return await stepsWithNames(transaction)
    .where("writingGroupNextStep.id", "=", id)
    .executeTakeFirstOrThrow();
}

/**
 * Idempotent in both directions, and the first completer wins: ticking an already-completed
 * step changes nothing, so two members ticking together do not overwrite each other.
 */
async function setCompleted(
  transaction: Transaction,
  stepId: StepId,
  done: boolean,
  userId: string,
): Promise<NextStep | undefined> {
  await transaction
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

  return await stepsWithNames(transaction)
    .where("writingGroupNextStep.id", "=", stepId)
    .executeTakeFirst();
}

/** Only under its own group, so a step id from another group finds nothing. */
async function selectStep(
  writingGroupId: GroupId,
  stepId: string,
): Promise<NextStep | undefined> {
  return await stepsWithNames()
    .where("writingGroupNextStep.writingGroupId", "=", writingGroupId)
    .where("writingGroupNextStep.id", "=", stepId)
    .executeTakeFirst();
}

async function deleteStep(
  transaction: Transaction,
  stepId: StepId,
): Promise<boolean> {
  const result = await transaction
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
