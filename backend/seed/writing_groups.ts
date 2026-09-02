import type { Selectable } from "kysely";
import type {
  UserInWritingGroupRole,
  UserInWritingGroupStatus,
  WritingGroup as DatabaseWritingGroup,
} from "@/src/database/schema.ts";
import { USER } from "@/seed/accounts.ts";
import {
  folderId,
  groupId,
  pageId,
  postId,
  stepId,
  threadId,
} from "@/seed/ids.ts";

type Member = {
  user: string;
  role: UserInWritingGroupRole;
  /** Defaults to `joined`, so only a pending invitation says so. */
  status?: UserInWritingGroupStatus;
};

type Post = {
  id: string;
  /** Null where the author's account is gone, which the interface shows as Gelöschtes Konto. */
  by: string | null;
  text: string;
  isDraft?: boolean;
};

type Step = {
  id: string;
  text: string;
  by: string;
  completedBy?: string;
};

/**
 * A fixture omits a column rather than writing null into it, so what it may leave out is optional
 * *and* never null — which `Partial<Pick<…>>` alone would not say.
 */
type Given<T, K extends keyof T> = { [P in K]?: NonNullable<T[P]> };

type GroupColumns = Selectable<DatabaseWritingGroup>;

/**
 * The columns come from the table, so a rename or a new vocabulary reaches the fixture as a
 * compile error rather than as a column the seed silently stops filling. Only what is not a
 * column is written out: the founder and the nested rows `write.ts` turns into their own inserts.
 */
export type GroupFixture =
  & Pick<GroupColumns, "id" | "title" | "synopsis" | "visibility">
  & Given<
    GroupColumns,
    | "subtitle"
    | "language"
    | "storyStatus"
    | "genres"
    | "subgenres"
    | "tropes"
    | "contentWarnings"
    | "storyThemes"
    | "storySettings"
    | "tense"
    | "perspective"
  >
  & {
    /** Founder. Also has to appear in `members` as a joined administrator; `write.ts` checks. */
    by: string;
    members: Member[];
    /**
     * Folders, deepest last: `write.ts` inserts them in order and derives `depth` from the
     * parent, so a child may only name a folder written before it.
     */
    folders?: Array<
      {
        id: string;
        title: string;
        by: string;
        in?: string;
        description?: string;
      }
    >;
    pages?: Array<
      { id: string; title: string; by: string; in?: string; text: string }
    >;
    threads?: Array<{
      id: string;
      title: string;
      by: string;
      posts: Post[];
      /** Which folder it sits in. Absent leaves it at the root, as most threads are. */
      in?: string;
    }>;
    steps?: Step[];
  };

/**
 * A thread with more posts than one page holds, so numbered pages are always testable against
 * the fixture. Five writers take turns, which also puts more than one name on the page.
 */
const LONG_THREAD_WRITERS = [
  USER.federkiel,
  USER.nachtschreiber,
  USER.tintenfleck,
  USER.lesezeichen,
  USER.silbenmeer,
] as const;

const LONG_THREAD_POSTS: Post[] = Array.from({ length: 105 }, (_, index) => ({
  id: postId(200 + index),
  // deno-lint-ignore no-non-null-assertion -- a modulo of the length is always in range
  by: LONG_THREAD_WRITERS[index % LONG_THREAD_WRITERS.length]!,
  text: `Aufstieg, Abschnitt ${
    index + 1
  }. Der Pfad wurde schmaler, und niemand sagte etwas.`,
}));

/**
 * Titles are real books, knocked slightly off course. They read as a community's inside joke
 * rather than as placeholder text, and nobody mistakes one for production data.
 *
 * Between them the eight cover every membership size from one to five, both visibilities,
 * every role, two-administrator groups in each visibility, and one group with nothing in it.
 */
/**
 * Nine more chapters for Pride and Punctuation, so its tab strip always holds ten threads: the
 * strip scrolls horizontally with its scrollbar hidden, and whether that is reachable is only
 * answerable with more tabs than fit. Titles of uneven length on purpose — a strip of equally
 * short labels would not show where it starts to overflow.
 */
const FURTHER_CHAPTERS: NonNullable<GroupFixture["threads"]> = [
  "Chapter Two — The Semicolon Incident",
  "Chapter Three",
  "Chapter Four — In Which a Dash Is Overused",
  "Chapter Five",
  "Chapter Six — Correspondence, Mostly Unsent",
  "Chapter Seven",
  "Chapter Eight — A Comma Changes Everything",
  "Chapter Nine",
  "Chapter Ten — Rewritten Twice",
].map((title, index) => ({
  id: threadId(30 + index),
  title,
  by: index % 2 === 0 ? USER.randnotiz : USER.kommafehler,
  posts: [
    {
      id: postId(400 + index),
      by: index % 2 === 0 ? USER.kommafehler : USER.randnotiz,
      text:
        "They agreed on the punctuation and on nothing else, which was progress of a kind.",
    },
  ],
}));

const WRITTEN_GROUPS: GroupFixture[] = [
  {
    id: groupId(1),
    title: "Die unendliche Gliederung",
    subtitle: "Ein Entwurf, der nie aufhört",
    synopsis:
      "Öffentlich, und bisher schreibt hier nur eine Person. Genau dafür ist die Gruppe da: " +
      "anfangen, ohne auf jemanden zu warten.",
    visibility: "public",
    storyStatus: "writing",
    by: USER.tintenfleck,
    members: [{ user: USER.tintenfleck, role: "administrator" }],
    threads: [
      {
        id: threadId(1),
        title: "Erster Entwurf",
        by: USER.tintenfleck,
        posts: [
          {
            id: postId(1),
            by: USER.tintenfleck,
            text:
              "Kapitel eins beginnt mit einer Tür, die niemand geschlossen hat.",
          },
          {
            id: postId(2),
            by: USER.tintenfleck,
            text:
              "Dahinter ein Flur, und am Ende des Flurs noch eine Gliederung.",
          },
        ],
      },
    ],
  },
  {
    id: groupId(2),
    title: "Pride and Punctuation",
    subtitle:
      "It is a truth universally acknowledged that a comma changes everything",
    synopsis:
      "A public group writing in English. Two of us so far, and we argue about semicolons " +
      "more than about the plot.",
    visibility: "public",
    language: "english",
    storyStatus: "writing",
    genres: ["romance"],
    tropes: ["slow_burn", "enemies_to_lovers"],
    tense: "past",
    by: USER.randnotiz,
    members: [
      { user: USER.randnotiz, role: "administrator" },
      { user: USER.kommafehler, role: "writer" },
    ],
    threads: [
      {
        id: threadId(2),
        title: "Chapter One",
        by: USER.randnotiz,
        posts: [
          {
            id: postId(3),
            by: USER.randnotiz,
            text:
              "She had read the letter twice, and disliked it more the second time.",
          },
          {
            id: postId(4),
            by: USER.kommafehler,
            text:
              "He had written it once, and disliked it immediately; that was the difference between them.",
          },
        ],
      },
      ...FURTHER_CHAPTERS,
    ],
  },
  {
    id: groupId(3),
    title: "Der Zauberzwerg",
    subtitle: "Sieben Jahre auf einem sehr kleinen Berg",
    synopsis:
      "Die größte offene Gruppe hier. Zwei Leute verwalten sie, damit nicht alles an einer " +
      "Person hängt, und wer mitlesen will, darf das sofort.",
    visibility: "public",
    storyStatus: "writing",
    genres: ["fantasy", "comedy"],
    subgenres: ["portal_fantasy"],
    tropes: ["found_family", "forced_proximity"],
    contentWarnings: ["mental_illness"],
    tense: "past",
    perspective: "third_person_limited",
    by: USER.federkiel,
    // A nested tree, so the rail and the group page have something with depth in them on a
    // fresh checkout. Deepest last: `write.ts` derives each folder's depth from its parent.
    folders: [
      {
        id: folderId(1),
        title: "Weltenbau",
        by: USER.federkiel,
        description: "Orte, Regeln und was auf dem Berg sonst gilt.",
      },
      {
        id: folderId(2),
        title: "Stadt A",
        by: USER.federkiel,
        in: folderId(1),
      },
      { id: folderId(3), title: "Personen", by: USER.nachtschreiber },
    ],
    pages: [
      {
        id: pageId(1),
        title: "Der Berg",
        by: USER.federkiel,
        in: folderId(1),
        text:
          "Der Berg ist kleiner als sein Ruf. Wer oben ankommt, merkt es zuerst am Wind.",
      },
      {
        id: pageId(2),
        title: "Das Kino",
        by: USER.tintenfleck,
        in: folderId(2),
        text: "Ein Kino mit zwei Sälen, von denen einer immer geschlossen ist.",
      },
      {
        id: pageId(3),
        title: "Der Zwerg",
        by: USER.nachtschreiber,
        in: folderId(3),
        text:
          "Klein, zauberhaft, und mit einer Liste, auf der sein Name nicht stand.",
      },
      {
        // At the root, so the tree shows a leaf above the folders as the ordering intends.
        id: pageId(4),
        title: "Wie wir hier schreiben",
        by: USER.federkiel,
        text:
          "Ein Beitrag pro Szene. Wer eine Figur übernimmt, sagt es vorher an.",
      },
    ],
    members: [
      { user: USER.federkiel, role: "administrator" },
      { user: USER.nachtschreiber, role: "administrator" },
      { user: USER.tintenfleck, role: "writer" },
      { user: USER.lesezeichen, role: "reader" },
      { user: USER.silbenmeer, role: "writer", status: "invited" },
    ],
    threads: [
      {
        id: threadId(3),
        title: "Ankunft",
        by: USER.federkiel,
        posts: [
          {
            id: postId(5),
            by: USER.federkiel,
            text:
              "Der Zug hielt an einem Bahnsteig, der kürzer war als der Zug selbst.",
          },
          {
            id: postId(6),
            by: USER.tintenfleck,
            text:
              "Oben empfing ihn ein Zwerg mit einer Liste. Sein Name stand nicht darauf.",
          },
          // No author: the account was deleted, and the writing stayed. Without this the
          // "Gelöschtes Konto" state is only reachable by deleting an account mid-test.
          {
            id: postId(7),
            by: null,
            text:
              "Sieben Jahre, sagte der Zwerg, seien hier oben eine Woche. Niemand widersprach.",
          },
        ],
      },
      {
        id: threadId(4),
        title: "Figuren",
        // Reference material kept as a thread, which is the misuse #109 is about — seeded inside
        // the folder beside the page that replaces it, so the difference is visible.
        in: folderId(3),
        by: USER.nachtschreiber,
        posts: [
          {
            id: postId(8),
            by: USER.nachtschreiber,
            text: "Der Zwerg: verwaltet den Berg, hat ihn nie verlassen.",
          },
        ],
      },
      {
        id: threadId(10),
        title: "Der lange Aufstieg",
        by: USER.federkiel,
        // Long on purpose: paging, the order toggle and a truthful post count need a thread
        // that outgrows one page. The number is in the text so a wrong page or a repeated row
        // is visible at a glance rather than something to count. Ids run from 200 to keep out
        // of the way of the hand-written ones above.
        posts: LONG_THREAD_POSTS,
      },
    ],
    steps: [
      {
        id: stepId(1),
        text: "Zeitrechnung auf dem Berg festlegen",
        by: USER.nachtschreiber,
      },
      { id: stepId(2), text: "Kapitel 2 anlegen", by: USER.federkiel },
      {
        id: stepId(3),
        text: "Personenliste anlegen",
        by: USER.federkiel,
        completedBy: USER.nachtschreiber,
      },
    ],
  },
  {
    id: groupId(4),
    title: "Wuthering Depths",
    synopsis:
      "Öffentlich, und die meisten hier lesen mit statt zu schreiben. Gut zu sehen, was eine " +
      "Leserin darf und was nicht.",
    visibility: "public",
    storyStatus: "planning",
    genres: ["horror"],
    by: USER.lesezeichen,
    members: [
      { user: USER.lesezeichen, role: "administrator" },
      { user: USER.zeilensprung, role: "reader" },
      { user: USER.randnotiz, role: "reader" },
    ],
    threads: [
      {
        id: threadId(5),
        title: "Das Moor",
        by: USER.lesezeichen,
        posts: [
          {
            id: postId(9),
            by: USER.lesezeichen,
            text:
              "Das Haus stand tiefer als der Weg, und im Herbst stand es im Wasser.",
          },
          {
            id: postId(10),
            by: USER.lesezeichen,
            text: "Wer dort wohnte, sprach vom Moor wie von einem Nachbarn.",
          },
        ],
      },
    ],
  },
  {
    id: groupId(5),
    title: "Die Leiden des jungen Lektors",
    subtitle: "Was du streichst, gehört jemand anderem",
    synopsis:
      "Eine private Gruppe mit allem, was eine Gruppe haben kann: jede Rolle, eine offene " +
      "Einladung, Threads, ein Entwurf und die vollständigen Angaben zur Geschichte.",
    visibility: "private",
    storyStatus: "writing",
    genres: ["fantasy", "mystery"],
    subgenres: ["urban_fantasy"],
    tropes: ["slow_burn", "found_family"],
    contentWarnings: ["grief"],
    tense: "past",
    perspective: "third_person_limited",
    by: USER.tintenfleck,
    members: [
      { user: USER.tintenfleck, role: "administrator" },
      { user: USER.zeilensprung, role: "writer" },
      { user: USER.randnotiz, role: "reader" },
      { user: USER.silbenmeer, role: "writer", status: "invited" },
    ],
    threads: [
      {
        id: threadId(6),
        title: "Plot",
        by: USER.tintenfleck,
        posts: [
          {
            id: postId(11),
            by: USER.tintenfleck,
            text: "Die Laternen gingen aus, und das Lektorat öffnete.",
          },
          {
            id: postId(12),
            by: USER.zeilensprung,
            text:
              "Sie hatte sich vorgenommen, nichts zu streichen. Das nahmen sich alle vor, sagte der Lektor.",
          },
          // Unpublished, so the composer has something to restore and the draft rules show.
          {
            id: postId(13),
            by: USER.tintenfleck,
            text:
              "Noch nicht fertig — was, wenn das Manuskript sie schon kennt?",
            isDraft: true,
          },
        ],
      },
      {
        id: threadId(7),
        title: "Steckbriefe",
        by: USER.zeilensprung,
        posts: [
          {
            id: postId(14),
            by: USER.zeilensprung,
            text: "Der Lektor: keine Erinnerung an seinen eigenen ersten Satz.",
          },
        ],
      },
    ],
    steps: [
      {
        id: stepId(4),
        text: "Motiv des Lektors festlegen",
        by: USER.zeilensprung,
      },
      {
        id: stepId(5),
        text: "Kapitel 1 eröffnen",
        by: USER.tintenfleck,
        completedBy: USER.tintenfleck,
      },
    ],
  },
  {
    id: groupId(6),
    title: "Effi Briefe",
    subtitle: "Zwei Adressen, ein Streit",
    synopsis: "Privat, zu zweit, und alles läuft über Briefe.",
    visibility: "private",
    storyStatus: "writing",
    genres: ["historical"],
    tropes: ["epistolary"],
    by: USER.zeilensprung,
    members: [
      { user: USER.zeilensprung, role: "administrator" },
      { user: USER.tintenfleck, role: "writer" },
    ],
    threads: [
      {
        id: threadId(8),
        title: "Erster Brief",
        by: USER.zeilensprung,
        posts: [
          {
            id: postId(15),
            by: USER.zeilensprung,
            text:
              "Liebe A., der Garten ist größer als das Haus, und das Haus ist zu groß.",
          },
          {
            id: postId(16),
            by: USER.tintenfleck,
            text:
              "Liebe E., schreib mir, wenn der Garten anfängt, zurückzuschreiben.",
          },
          {
            id: postId(17),
            by: USER.zeilensprung,
            text: "Er hat. Mehr dazu, wenn ich weiß, wie ich es sagen soll.",
            isDraft: true,
          },
        ],
      },
    ],
  },
  {
    id: groupId(7),
    title: "Der Vorletzte",
    synopsis:
      "Privat, eine Person, nichts darin. Der leere Zustand jeder Ansicht ist hier zu sehen, " +
      "ohne erst eine Gruppe anzulegen.",
    visibility: "private",
    by: USER.silbenmeer,
    members: [{ user: USER.silbenmeer, role: "administrator" }],
  },
  {
    id: groupId(8),
    title: "Die Verwandtschaft",
    subtitle: "Eines Morgens war die Familie da",
    synopsis:
      "Privat, zwei Verwalterinnen, und die nächsten Schritte sind größtenteils abgehakt.",
    visibility: "private",
    storyStatus: "finished",
    genres: ["literary"],
    tropes: ["forced_proximity"],
    tense: "past",
    by: USER.nachtschreiber,
    members: [
      { user: USER.nachtschreiber, role: "administrator" },
      { user: USER.kommafehler, role: "administrator" },
      { user: USER.federkiel, role: "writer" },
    ],
    threads: [
      {
        id: threadId(9),
        title: "Der Käfer",
        by: USER.nachtschreiber,
        posts: [
          {
            id: postId(18),
            by: USER.kommafehler,
            text:
              "Als er erwachte, saß die ganze Verwandtschaft am Fußende des Bettes und wartete.",
          },
        ],
      },
    ],
    steps: [
      {
        id: stepId(6),
        text: "Letztes Kapitel abschließen",
        by: USER.nachtschreiber,
        completedBy: USER.kommafehler,
      },
      {
        id: stepId(7),
        text: "Titel entscheiden",
        by: USER.kommafehler,
        completedBy: USER.nachtschreiber,
      },
      { id: stepId(8), text: "Epilog überlegen", by: USER.federkiel },
    ],
  },
];

/**
 * Nine more public groups, so "Gruppen entdecken" always has more than one page.
 *
 * Nine rather than the seven that would make eleven: discovery hides the groups you are in, so
 * the busiest account sees eleven of thirteen rather than all of them — and eleven public
 * groups would have left it with nine, one page, and nothing to page through. Founded by
 * silbenmeer alone for the same reason: spreading them over the demo accounts would shrink
 * what each of those accounts can discover.
 */
const DISCOVERABLE_TITLES = [
  "Der Prozess der Überarbeitung",
  "Faust, zweiter Entwurf",
  "Die Blechtrommel-AG",
  "Momo und die Abgabefrist",
  "Die Wahlverwandtschaften der Nebenfiguren",
  "Emil und die Detektive der Zeitform",
  "Die Räuber der verlorenen Pointe",
  "Krieg und Frieden am Freitagabend",
  "Der Steppenwolf lernt Absätze",
] as const;

const DISCOVERABLE_GROUPS: GroupFixture[] = DISCOVERABLE_TITLES.map((
  title,
  index,
) => ({
  id: groupId(20 + index),
  title,
  synopsis:
    "Öffentlich und noch klein. Steht hier, damit die Entdecken-Seite mehr als eine Seite hat.",
  visibility: "public",
  by: USER.silbenmeer,
  members: [{ user: USER.silbenmeer, role: "administrator" }],
}));

export const GROUPS: GroupFixture[] = [
  ...WRITTEN_GROUPS,
  ...DISCOVERABLE_GROUPS,
];
