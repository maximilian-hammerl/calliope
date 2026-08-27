import type { UserInChatGroupStatus } from "@/src/database/schema.ts";
import { USER } from "@/seed/accounts.ts";
import { chatId, messageId } from "@/seed/ids.ts";

export type ChatFixture = {
  id: string;
  title: string;
  /** Creator. Also has to appear in `members` as joined; `write.ts` checks. */
  by: string;
  members: Array<{ user: string; status?: UserInChatGroupStatus }>;
  messages: Array<{
    id: string;
    by: string;
    text: string;
    /**
     * A minute after the message before it rather than the usual five, so the two fall inside
     * the window the conversation groups by and share one name and time. Only says something
     * when the message before it is by the same person.
     */
    continues?: true;
  }>;
};

/**
 * Three chats: a pair, a group of four, and one nobody has accepted yet — so the unread count,
 * a busier thread, a run of two remarks from one person and the invited state are all reachable
 * without arranging them by hand.
 */
export const CHATS: ChatFixture[] = [
  {
    id: chatId(1),
    title: "Zum jungen Lektor",
    by: USER.tintenfleck,
    members: [
      { user: USER.tintenfleck },
      { user: USER.zeilensprung },
      // Invited and not yet accepted, so that state is reachable too.
      { user: USER.randnotiz, status: "invited" },
    ],
    messages: [
      {
        id: messageId(1),
        by: USER.tintenfleck,
        text: "Hast du den zweiten Absatz gelesen?",
      },
      {
        id: messageId(2),
        by: USER.zeilensprung,
        text: "Ja. Der Lektor darf ruhig unangenehmer sein.",
      },
      {
        id: messageId(3),
        by: USER.tintenfleck,
        text: "Einverstanden. Ich schreibe heute Abend weiter.",
      },
    ],
  },
  {
    id: chatId(2),
    title: "Bergrunde",
    by: USER.federkiel,
    members: [
      { user: USER.federkiel },
      { user: USER.nachtschreiber },
      { user: USER.tintenfleck },
      { user: USER.lesezeichen, status: "invited" },
    ],
    messages: [
      {
        id: messageId(4),
        by: USER.federkiel,
        text: "Ich hätte gern eine Zeitrechnung, bevor wir Kapitel 2 anfangen.",
      },
      {
        id: messageId(5),
        by: USER.nachtschreiber,
        text: "Eine Woche oben, sieben Jahre unten. Steht als Schritt drin.",
      },
      {
        id: messageId(6),
        by: USER.tintenfleck,
        text: "Dann schreibe ich die Ankunft entsprechend um.",
      },
      {
        id: messageId(7),
        by: USER.federkiel,
        text: "Perfekt. Lesezeichen habe ich gerade eingeladen.",
      },
      {
        id: messageId(9),
        by: USER.federkiel,
        text: "Die Karte hänge ich morgen dazu.",
        continues: true,
      },
    ],
  },
  {
    id: chatId(3),
    title: "Storyidee: Briefe aus dem Leuchtturm",
    by: USER.silbenmeer,
    members: [
      { user: USER.silbenmeer },
      { user: USER.zeilensprung, status: "invited" },
    ],
    messages: [
      {
        id: messageId(8),
        by: USER.silbenmeer,
        text:
          "Ich würde gern den zweiten Wächter schreiben, wenn der Platz noch frei ist.",
      },
    ],
  },
];
