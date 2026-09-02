/**
 * Obviously synthetic and stable: recognisable in a query, and links keep working.
 *
 * One letter per kind, and **never a leading zero** — `padStart` makes `"0a1"` and `"a1"` the
 * same id, which is how a user once shared an id with a notification. `assertDistinct` in
 * `write.ts` is the guard that makes this class of mistake impossible rather than fixed once.
 */
const id = (suffix: string) =>
  `01a00000-0000-7000-8000-${suffix.padStart(12, "0")}`;

const kind = (letter: string) => (n: number) => id(`${letter}${n}`);

export const userId = kind("a");
export const groupId = kind("b");
export const threadId = kind("c");
export const postId = kind("d");
export const chatId = kind("e");
export const messageId = kind("f");
export const stepId = kind("9");
export const storyIdeaId = kind("7");
export const notificationId = kind("8");
export const reportId = kind("6");
export const favouriteId = kind("5");
export const folderId = kind("4");
export const pageId = kind("3");
