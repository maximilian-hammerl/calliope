import { USER } from "@/seed/accounts.ts";
import { folderId, pageId, postId, threadId } from "@/seed/ids.ts";
import type { ForumPermission } from "@/src/database/schema.ts";

/**
 * The public forum (#32): the same tables with `writing_group_id` null, so this says only where
 * each thing sits and what a member may do with it.
 *
 * All three permissions appear, and a page at the root. „Werkstatt" is hidden, so an operator sees
 * something a member never does.
 */

export type ForumFolderFixture = {
  id: string;
  title: string;
  by: string;
  may: ForumPermission;
  in?: string;
  description?: string;
};

export type ForumThreadFixture = {
  id: string;
  title: string;
  by: string;
  in?: string;
  may?: ForumPermission;
  posts: Array<{ id: string; by: string; text: string }>;
};

export type ForumPageFixture = {
  id: string;
  title: string;
  by: string;
  in?: string;
  may?: ForumPermission;
  text: string;
};

export const FORUM_FOLDERS: ForumFolderFixture[] = [
  {
    id: folderId(11),
    title: "Ankündigungen",
    by: USER.tintenfleck,
    may: "read",
    description: "Was das Team mitteilt. Lesen, nicht schreiben.",
  },
  {
    id: folderId(12),
    title: "Forenspiele",
    by: USER.tintenfleck,
    may: "write",
    description: "Reihum, ohne Ende. Hier darf jede und jeder mitschreiben.",
  },
  {
    id: folderId(13),
    title: "Beendete Spiele",
    by: USER.tintenfleck,
    may: "read",
    in: folderId(12),
    description: "Zum Nachlesen. Geschrieben wird hier nicht mehr.",
  },
  {
    id: folderId(14),
    title: "Werkstatt",
    by: USER.tintenfleck,
    may: "hidden",
    description: "Noch nicht öffentlich.",
  },
  {
    id: folderId(15),
    title: "Bücherclub",
    by: USER.silbenmeer,
    may: "write",
    description: "Was wir lesen, und was wir davon halten.",
  },
  // A third level, so the seed shows that the reduction runs the whole path rather than one step.
  {
    id: folderId(16),
    title: "Sommer 2024",
    by: USER.tintenfleck,
    may: "write",
    in: folderId(13),
    description: "Auch geschlossen — der Ordner darüber entscheidet.",
  },
];

/** A compound-word chain, which is what a forum game looks like: many posts, each one word. */
const WORD_CHAIN = [
  "Abendrot",
  "Rotkohl",
  "Kohlmeise",
  "Meisenknödel",
  "Knödelsuppe",
  "Suppenlöffel",
  "Löffelstiel",
  "Stielauge",
  "Augenblick",
  "Blickwinkel",
  "Winkelmesser",
  "Messerspitze",
  "Spitzhacke",
  "Hackbrett",
  "Brettspiel",
  "Spielplatz",
  "Platzregen",
  "Regenbogen",
  "Bogenschütze",
  "Schützenfest",
  "Festtag",
  "Tagebuch",
  "Buchdeckel",
];

const CHAIN_AUTHORS = [
  USER.randnotiz,
  USER.silbenmeer,
  USER.zeilensprung,
  USER.federkiel,
];

export const FORUM_THREADS: ForumThreadFixture[] = [
  {
    id: threadId(21),
    title: "Was schaust du gerade?",
    by: USER.zeilensprung,
    in: folderId(12),
    posts: [
      {
        id: postId(501),
        by: USER.zeilensprung,
        text:
          "Eine Serie über einen Leuchtturm, in der bisher nichts passiert.",
      },
      {
        id: postId(502),
        by: USER.randnotiz,
        text: "Das klingt nach genau der Sorte, bei der man mitschreiben will.",
      },
      {
        id: postId(503),
        by: USER.federkiel,
        text: "Bei mir läuft ein Film, den ich zum dritten Mal nicht verstehe.",
      },
    ],
  },
  {
    id: threadId(22),
    title: "Wortkette",
    by: USER.randnotiz,
    in: folderId(12),
    // Twenty-three, so this is the one thread that pages: `POSTS_PER_PAGE` is twenty, and a
    // fixture that never crosses it cannot show the strip at all.
    posts: WORD_CHAIN.map((word, index) => ({
      id: postId(520 + index),
      by: CHAIN_AUTHORS[index % CHAIN_AUTHORS.length] ?? USER.randnotiz,
      text: word,
    })),
  },
  {
    id: threadId(23),
    title: "Sommerwettbewerb 2025",
    by: USER.tintenfleck,
    in: folderId(13),
    posts: [
      {
        id: postId(506),
        by: USER.tintenfleck,
        text: "Danke an alle, die mitgeschrieben haben. Der Faden ist zu.",
      },
    ],
  },
  {
    id: threadId(25),
    title: "Was liest du gerade?",
    by: USER.silbenmeer,
    in: folderId(15),
    posts: [
      {
        id: postId(560),
        by: USER.silbenmeer,
        text:
          "Einen Roman, in dem zweihundert Seiten lang nichts als das Wetter passiert.",
      },
      {
        id: postId(561),
        by: USER.kommafehler,
        text: "Und, wird es besser?",
      },
      {
        id: postId(562),
        by: USER.silbenmeer,
        text: "Es wird nasser.",
      },
    ],
  },
  {
    id: threadId(26),
    title: "Buch des Monats: Der Wind",
    by: USER.silbenmeer,
    in: folderId(15),
    // The one leaf that restricts below its folder: „Bücherclub" grants `write`, and this thread
    // is the announcement in it rather than a conversation. What another forum calls locked.
    may: "read",
    posts: [
      {
        id: postId(563),
        by: USER.silbenmeer,
        text:
          "Im September lesen wir „Der Wind“. Besprochen wird im Faden darunter.",
      },
    ],
  },
  {
    id: threadId(27),
    title: "Silbenrätsel",
    by: USER.randnotiz,
    in: folderId(16),
    posts: [
      {
        id: postId(564),
        by: USER.randnotiz,
        text:
          "Vier Silben, zwei davon gelogen. Das Spiel ist vorbei, die Lösung stand hier.",
      },
    ],
  },
  {
    id: threadId(24),
    title: "Entwurf: Winterwettbewerb",
    by: USER.tintenfleck,
    in: folderId(14),
    posts: [
      {
        id: postId(507),
        by: USER.tintenfleck,
        text: "Regeln stehen noch nicht. Nicht veröffentlichen.",
      },
    ],
  },
];

export const FORUM_PAGES: ForumPageFixture[] = [
  {
    id: pageId(11),
    title: "Willkommen im Forum",
    by: USER.tintenfleck,
    text:
      "Hier wird öffentlich geschrieben: über Bücher, über das Schreiben, und manchmal reihum in einem Spiel.\n\nWas in einer Schreibgruppe entsteht, bleibt dort. Dieses Forum ist das andere: der Teil, den alle sehen.",
  },
  {
    id: pageId(12),
    title: "Regeln",
    by: USER.tintenfleck,
    in: folderId(11),
    text:
      "Sei freundlich. Lies, bevor du antwortest. Wer sich nicht daran hält, wird gemeldet und dann nicht mehr gefragt.",
  },
  {
    id: pageId(14),
    title: "Werkstattnotizen",
    by: USER.tintenfleck,
    in: folderId(14),
    text:
      "Ideen für das nächste Forenspiel. Steht hier, solange der Ordner versteckt ist.",
  },
  {
    id: pageId(13),
    title: "Häufige Fragen",
    by: USER.randnotiz,
    in: folderId(11),
    text:
      "Wie trete ich einer Gruppe bei? Über „Gruppen entdecken“, und dann über eine Anfrage an die Gruppe selbst.",
  },
];
