import { HTTPException } from "hono/http-exception";
import { STATUS_CODE } from "@std/http/status";
import type { ErrorResponse } from "@/src/http/response.ts";
import type { StoryGenre, StorySubgenre } from "@/src/database/schema.ts";
import {
  SUBGENRE_GENRE,
  subgenresOutsideGenres,
} from "@/src/story_metadata.ts";

/**
 * Refuses a row whose subgenres sit under no genre it carries.
 *
 * **Against the resulting row, which is why it is not a `superRefine` on the bodies.** A create
 * body carries both fields and a schema could compare them, but a PATCH need not: `{"genres":
 * ["western"]}` alone orphans a `dark_fantasy` already stored, and no rule written against the
 * request can see that. Putting it in the schema for creates only would leave the schema unable
 * to be the authority while looking like it was.
 *
 * Thrown rather than returned: the two services and their four routes would each have to carry a
 * third outcome beside "saved" and "not found", and `HTTPException` is what Hono already treats as
 * an expected refusal — the request log classifies it as a warning rather than an error.
 *
 * The body is the shape `defaultHook` gives a failed schema, so a client reads one kind of 400
 * whether a rule was enforced at the edge or below it.
 */
export function refuseOrphanedSubgenres(
  genres: readonly StoryGenre[],
  subgenres: readonly StorySubgenre[],
): void {
  const orphaned = subgenresOutsideGenres(genres, subgenres);

  if (orphaned.length === 0) {
    return;
  }

  const issues = orphaned.map((subgenre) => ({
    path: "subgenres",
    message: `${subgenre} belongs to ${
      SUBGENRE_GENRE[subgenre]
    }, which is not among the genres`,
  }));

  throw new HTTPException(STATUS_CODE.BadRequest, {
    res: Response.json(
      { error: "Invalid request", issues } satisfies ErrorResponse,
      { status: STATUS_CODE.BadRequest },
    ),
  });
}
