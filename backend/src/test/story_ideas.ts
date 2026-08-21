import { request } from "@/src/test/support.ts";
import type { StoryIdeaStatus } from "@/src/database/schema.ts";

/**
 * Two names per test file, named by `scope`. Six files use these, and shared names had each
 * file's `afterEach` deleting the accounts another was still using.
 */
export function storyIdeaUsers(scope: string) {
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
    idea:
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
