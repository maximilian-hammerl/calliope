import { USER } from "@/seed/accounts.ts";

export type BlockFixture = {
  blocker: string;
  blocked: string;
};

/**
 * Two blocks, each chosen for what it makes visible without setting anything up by hand. Neither
 * involves `tintenfleck`: a block hides both members from each other's lists, and the account
 * most screens are demonstrated from should not have holes in its.
 */
export const BLOCKS: ReadonlyArray<BlockFixture> = [
  // Der Zauberzwerg has two administrators, and zeilensprung is in neither this group nor
  // Die Verwandtschaft — so "Unterhaltung beginnen" as zeilensprung invites federkiel alone,
  // which is the skip rule doing its job rather than a group falling out of reach.
  { blocker: USER.nachtschreiber, blocked: USER.zeilensprung },

  // These two share the public Pride and Punctuation and each has a story idea, so one pair
  // shows all three halves of the rule: their ideas vanish from each other's board, they cannot
  // invite one another, and the group they already share is untouched.
  { blocker: USER.kommafehler, blocked: USER.randnotiz },
];
