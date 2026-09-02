import { USER } from "@/seed/accounts.ts";
import {
  chatId,
  favouriteId,
  groupId,
  pageId,
  postId,
  storyIdeaId,
  threadId,
} from "@/seed/ids.ts";
import type { FavouriteTargetType } from "@/src/query/favourite.ts";

/**
 * All six kinds, because every filter is otherwise an empty list on a fresh checkout and the flag
 * is never true anywhere.
 *
 * It cannot show the *ordering* on groups, threads or chats: they sort by `last_activity_at`, which
 * the seed does not spread — see `write.ts`. Posts and ideas are staggered, so those two are where
 * a favourite visibly moves something.
 */
export type FavouriteFixture = {
  id: string;
  user: string;
  targetType: FavouriteTargetType;
  targetId: string;
};

export const FAVOURITES: ReadonlyArray<FavouriteFixture> = [
  // `tintenfleck` is the account the fixture is built around, so its four surfaces each have
  // something to filter to.
  {
    id: favouriteId(1),
    user: USER.tintenfleck,
    targetType: "writing_group",
    targetId: groupId(3),
  },
  // The same group, by somebody else. A favourite is the reader's own, and one row per member is
  // the only way to see that on screen rather than in a test.
  {
    id: favouriteId(2),
    user: USER.federkiel,
    targetType: "writing_group",
    targetId: groupId(3),
  },

  // The 105-post thread: coming back to the long one is the reason a thread is favouritable.
  {
    id: favouriteId(3),
    user: USER.tintenfleck,
    targetType: "writing_thread",
    targetId: threadId(10),
  },
  // Their own thread, which is allowed — marking what you are working on is the ordinary case.
  {
    id: favouriteId(4),
    user: USER.randnotiz,
    targetType: "writing_thread",
    targetId: threadId(2),
  },

  // Three posts spread across that thread's pages, which is the one place the post filter earns
  // itself: 105 posts, and these are the passages somebody meant to come back to. A favourite
  // leaves them where they were written, so the filter is the only way back to all three at once.
  {
    id: favouriteId(5),
    user: USER.tintenfleck,
    targetType: "writing_post",
    targetId: postId(203),
  },
  {
    id: favouriteId(6),
    user: USER.tintenfleck,
    targetType: "writing_post",
    targetId: postId(247),
  },
  {
    id: favouriteId(7),
    user: USER.tintenfleck,
    targetType: "writing_post",
    targetId: postId(301),
  },
  // The same post as above, by a member of no group at all: Der Zauberzwerg is public, and
  // reading a public group is what makes its posts favouritable by somebody outside it.
  {
    id: favouriteId(8),
    user: USER.zeilensprung,
    targetType: "writing_post",
    targetId: postId(203),
  },

  // Two ideas on the board `tintenfleck` pages through, far enough apart in the fixture that the
  // favourite carries one of them past the other on a board sorted by age.
  {
    id: favouriteId(9),
    user: USER.tintenfleck,
    targetType: "story_idea",
    targetId: storyIdeaId(1),
  },
  {
    id: favouriteId(10),
    user: USER.tintenfleck,
    targetType: "story_idea",
    targetId: storyIdeaId(30),
  },
  // Somebody else's favourite among the same set, so „Storyideen entdecken" is not one account's
  // view of the feature.
  {
    id: favouriteId(11),
    user: USER.lesezeichen,
    targetType: "story_idea",
    targetId: storyIdeaId(21),
  },

  {
    id: favouriteId(12),
    user: USER.tintenfleck,
    targetType: "chat_group",
    targetId: chatId(1),
  },
  {
    id: favouriteId(13),
    user: USER.nachtschreiber,
    targetType: "chat_group",
    targetId: chatId(2),
  },

  // A page, so the mark shows in the group's own tree and in a search result.
  {
    id: favouriteId(14),
    user: USER.tintenfleck,
    targetType: "writing_page",
    targetId: pageId(1),
  },
];
