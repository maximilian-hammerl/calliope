import { request } from "@/src/test/support.ts";
import { TEXT_LIMIT } from "@/src/text_limit.ts";
import type { StoryIdeaStatus } from "@/src/database/schema.ts";

/**
 * Two names per test file, named by `scope`. Six files use these, and shared names had each
 * file's `afterEach` deleting the accounts another was still using.
 */
export function storyIdeaUsers(scope: string) {
  // A long scope pushes the name past TEXT_LIMIT.username, and registration then fails in
  // whichever test happens to run first rather than saying what is wrong.
  if (`story-idea-${scope}-bystander`.length > TEXT_LIMIT.username) {
    throw new Error(
      `Scope "${scope}" makes a username longer than ${TEXT_LIMIT.username}`,
    );
  }

  return {
    author: `story-idea-${scope}-author`,
    bystander: `story-idea-${scope}-bystander`,
  };
}

export const createIdea = (
  cookie: string,
  values: Record<string, unknown> = {},
) =>
  request("POST", "/api/story-ideas", cookie, {
    title: "Der Leuchtturm am Ende der Zeit",
    teaser: "Zwei Wächter, eine See, die es nicht mehr gibt.",
    synopsis:
      "Zwei Wächter schreiben sich Briefe über eine See, die es nicht mehr gibt.",
    ...values,
  });

export const listIdeas = (
  cookie: string,
  body: Record<string, unknown> = {},
) => request("QUERY", "/api/story-ideas", cookie, body);

export const patchIdea = (
  cookie: string,
  ideaId: string,
  values: Record<string, unknown>,
) => request("PATCH", `/api/story-ideas/${ideaId}`, cookie, values);

export type SeenStatus = StoryIdeaStatus;
