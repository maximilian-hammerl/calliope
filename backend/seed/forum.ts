import { USER } from "@/seed/accounts.ts";
import { folderId, pageId, postId, threadId } from "@/seed/ids.ts";
import type { ForumPermission } from "@/src/database/schema.ts";

/**
 * The public forum (#32): the same tables with `writing_group_id` null, so this says only where
 * each thing sits and what a member may do with it.
 *
 * The shape follows a member's own draft of what the forum should hold, with one thing re-cut:
 * a folder's permission only ever *narrows*, so „Fragen & Vorschläge" is a room of its own rather
 * than two writable threads inside the closed „Regeln & Hilfe" — where they would have been
 * silently read-only. The rule is that a folder takes the most open permission anything in it
 * needs, and the closed items carry their own.
 *
 * What it has to keep exercising: all three permissions on folders, a leaf that closes below an
 * open folder, three levels so the reduction runs a path rather than one step, both leaf kinds,
 * and one thread long enough to page.
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

// A parent has to appear above its children, which `assertFoldersFollowTheirParents` checks.
export const FORUM_FOLDERS: ForumFolderFixture[] = [
  {
    id: folderId(11),
    title: "Regeln & Hilfe",
    by: USER.tintenfleck,
    may: "read",
    description: "Was das Team festhält. Gelesen, nicht geschrieben.",
  },
  {
    id: folderId(12),
    title: "Fragen & Vorschläge",
    by: USER.tintenfleck,
    may: "write",
    description:
      "Der Gegenpart zum Ordner darüber: hier fragt und schlägt vor, wer mag.",
  },
  {
    id: folderId(13),
    title: "Events",
    by: USER.tintenfleck,
    may: "write",
    description: "Wettbewerbe und Aktionen, jedes mit allem drin.",
  },
  {
    id: folderId(14),
    title: "Sommerwettbewerb 2026",
    by: USER.tintenfleck,
    may: "write",
    in: folderId(13),
    description: "Infos, Beiträge und die Diskussion danach.",
  },
  {
    id: folderId(15),
    title: "Archiv",
    by: USER.tintenfleck,
    may: "read",
    in: folderId(13),
    description: "Gelaufene Events. Zum Nachlesen.",
  },
  {
    id: folderId(16),
    title: "Community",
    by: USER.silbenmeer,
    may: "write",
    description: "Alles, was sonst keinen Platz hat.",
  },
  {
    id: folderId(17),
    title: "Vorstellungen",
    by: USER.silbenmeer,
    may: "write",
    in: folderId(16),
    description: "Ein Faden pro Person. Schreib deinen eigenen.",
  },
  {
    id: folderId(18),
    title: "Forenspiele",
    by: USER.randnotiz,
    may: "write",
    in: folderId(16),
    description: "Reihum, ohne Ende. Hier darf jede und jeder mitschreiben.",
  },
  // The third level, so the seed shows the reduction running the whole path rather than one step.
  {
    id: folderId(19),
    title: "Beendete Spiele",
    by: USER.randnotiz,
    may: "read",
    in: folderId(18),
    description: "Zum Nachlesen. Geschrieben wird hier nicht mehr.",
  },
  {
    id: folderId(20),
    title: "Werkstatt",
    by: USER.tintenfleck,
    may: "hidden",
    description: "Noch nicht öffentlich.",
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

// Numbered from 41: the group fixture owns 1–10 and, for Pride and Punctuation's ten chapters,
// 30–39. `assertDistinctIds` is what caught the overlap rather than a wrong row in the interface.
export const FORUM_THREADS: ForumThreadFixture[] = [
  {
    id: threadId(41),
    title: "Hilfe: Fragen an alle",
    by: USER.kommafehler,
    in: folderId(12),
    posts: [
      {
        id: postId(501),
        by: USER.kommafehler,
        text:
          "Ich finde die Gruppe nicht wieder, in der ich letzte Woche gelesen habe. Gibt es einen Verlauf?",
      },
      {
        id: postId(502),
        by: USER.randnotiz,
        text:
          "Setz sie als Favorit, dann steht sie oben in deiner Liste. Einen Verlauf gibt es nicht.",
      },
      {
        id: postId(503),
        by: USER.kommafehler,
        text: "Das hilft. Danke.",
      },
    ],
  },
  {
    id: threadId(42),
    title: "Verbesserungsvorschläge",
    by: USER.zeilensprung,
    in: folderId(12),
    posts: [
      {
        id: postId(504),
        by: USER.zeilensprung,
        text:
          "Ich hätte gern eine Notiz an einer Gruppe, die nur ich sehe. Für den Faden, in dem ich den Überblick verliere.",
      },
      {
        id: postId(505),
        by: USER.lesezeichen,
        text:
          "Und einen Entwurf, der über mehrere Tage stehen bleibt. Bei mir wird ein Beitrag selten an einem Abend fertig.",
      },
    ],
  },
  {
    id: threadId(43),
    title: "Eure Beiträge",
    by: USER.tintenfleck,
    in: folderId(14),
    posts: [
      {
        id: postId(506),
        by: USER.tintenfleck,
        text:
          "Ein Beitrag pro Person, höchstens tausend Wörter. Häng ihn hier an, nicht in die Infos.",
      },
      {
        id: postId(507),
        by: USER.federkiel,
        text:
          "Meiner spielt an einem Bahnhof, an dem seit vierzig Jahren kein Zug gehalten hat.",
      },
      {
        id: postId(508),
        by: USER.nachtschreiber,
        text: "Meiner ist zu lang. Ich kürze noch.",
      },
    ],
  },
  {
    id: threadId(44),
    title: "Gewinner & Diskussion",
    by: USER.tintenfleck,
    in: folderId(14),
    posts: [
      {
        id: postId(509),
        by: USER.tintenfleck,
        text:
          "Ausgezählt wird, sobald alle Beiträge stehen. Bis dahin ist hier Platz zum Streiten.",
      },
    ],
  },
  {
    id: threadId(45),
    title: "Sommerwettbewerb 2025",
    by: USER.tintenfleck,
    in: folderId(15),
    posts: [
      {
        id: postId(510),
        by: USER.tintenfleck,
        text: "Danke an alle, die mitgeschrieben haben. Der Faden ist zu.",
      },
    ],
  },
  {
    id: threadId(46),
    title: "Smalltalk",
    by: USER.silbenmeer,
    in: folderId(16),
    posts: [
      {
        id: postId(511),
        by: USER.silbenmeer,
        text:
          "Bei mir regnet es seit drei Tagen, und ich habe seit drei Tagen kein Wort geschrieben. Zusammenhang unklar.",
      },
      {
        id: postId(512),
        by: USER.zeilensprung,
        text: "Bei mir ist es umgekehrt. Ich schreibe nur, wenn es regnet.",
      },
    ],
  },
  {
    id: threadId(47),
    title: "Abschiede",
    by: USER.silbenmeer,
    in: folderId(16),
    // Closed below an open folder, and the one row where a member meets the read-only mark inside
    // a room they may otherwise write in: an abschied is read, not answered.
    may: "read",
    posts: [
      {
        id: postId(513),
        by: USER.silbenmeer,
        text:
          "Wer geht, darf das hier hinschreiben. Geantwortet wird nicht — wer etwas sagen möchte, schreibt persönlich.",
      },
    ],
  },
  {
    id: threadId(48),
    title: "Zeichenecke",
    by: USER.lesezeichen,
    in: folderId(16),
    posts: [
      {
        id: postId(514),
        by: USER.lesezeichen,
        text:
          "Ich zeichne die Figuren, über die hier geschrieben wird. Wer eine möchte, sagt Bescheid.",
      },
      {
        id: postId(515),
        by: USER.nachtschreiber,
        text: "Meine Leuchtturmwärterin hätte gern ein Gesicht.",
      },
    ],
  },
  {
    id: threadId(49),
    title: "Wer bist du?",
    by: USER.federkiel,
    in: folderId(17),
    posts: [
      {
        id: postId(516),
        by: USER.federkiel,
        text:
          "Ich schreibe seit zwölf Jahren an demselben Roman und habe kein Interesse daran, ihn zu beenden.",
      },
    ],
  },
  {
    id: threadId(50),
    title: "Wortkette",
    by: USER.randnotiz,
    in: folderId(18),
    // Twenty-three, so this is the one thread that pages: `POSTS_PER_PAGE` is twenty, and a
    // fixture that never crosses it cannot show the strip at all.
    posts: WORD_CHAIN.map((word, index) => ({
      id: postId(520 + index),
      by: CHAIN_AUTHORS[index % CHAIN_AUTHORS.length] ?? USER.randnotiz,
      text: word,
    })),
  },
  {
    id: threadId(52),
    title: "Entwurf: Winteraktion",
    by: USER.tintenfleck,
    in: folderId(20),
    posts: [
      {
        id: postId(561),
        by: USER.tintenfleck,
        text: "Regeln stehen noch nicht. Nicht veröffentlichen.",
      },
    ],
  },
  {
    id: threadId(51),
    title: "Silbenrätsel",
    by: USER.randnotiz,
    in: folderId(19),
    posts: [
      {
        id: postId(560),
        by: USER.randnotiz,
        text:
          "Vier Silben, zwei davon gelogen. Das Spiel ist vorbei, die Lösung stand hier.",
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
      "Hier wird öffentlich geschrieben: über das Schreiben, über alles daneben, und manchmal reihum in einem Spiel.\n\nWas in einer Schreibgruppe entsteht, bleibt dort. Dieses Forum ist das andere: der Teil, den alle sehen.",
  },
  {
    id: pageId(12),
    title: "Forenregeln",
    by: USER.tintenfleck,
    in: folderId(11),
    text:
      "Sei freundlich. Lies, bevor du antwortest. Wer sich nicht daran hält, wird gemeldet und dann nicht mehr gefragt.\n\nWas hier steht, gilt im ganzen Forum. Was in einer Gruppe gilt, entscheidet die Gruppe.",
  },
  {
    id: pageId(13),
    title: "Quellenangaben",
    by: USER.tintenfleck,
    in: folderId(11),
    text:
      "Wenn du ein Bild, einen Text oder eine Idee von jemand anderem zeigst, schreib dazu, woher es kommt — Name, wo du es gefunden hast, und ob du fragen musstest.\n\nBei einem eigenen Bild reicht „von mir“. Das Feld beim Profilbild fragt genau danach.",
  },
  {
    id: pageId(14),
    title: "Triggerwarnungen",
    by: USER.randnotiz,
    in: folderId(11),
    text:
      "Setz eine Warnung an den Anfang, nicht ans Ende. Eine Warnung, die man erst nach der Stelle liest, ist keine.\n\nGruppen tragen ihre Warnungen im Steckbrief. Im Forum schreibst du sie in den ersten Beitrag.",
  },
  {
    id: pageId(15),
    title: "Wie Schreibgruppen funktionieren",
    by: USER.tintenfleck,
    in: folderId(11),
    text:
      "Eine Gruppe ist der private Teil: Themen, Seiten, Ordner und ein Steckbrief zur Geschichte. Wer schreiben will, braucht eine Einladung.\n\nEine öffentliche Gruppe kann jede und jeder sofort mitlesen. Eine private sieht nur, wer drin ist.",
  },
  {
    id: pageId(16),
    title: "Glossar",
    by: USER.randnotiz,
    in: folderId(11),
    text:
      "Gruppe — der private Ort, an dem geschrieben wird.\nThema — ein Faden aus Beiträgen.\nSeite — ein Text ohne Antworten, den alle bearbeiten dürfen.\nStoryidee — ein Vorschlag, aus dem eine Gruppe werden kann.\nOrdner — was Themen und Seiten sortiert.",
  },
  {
    id: pageId(17),
    title: "Häufige Fragen",
    by: USER.randnotiz,
    in: folderId(11),
    text:
      "**Wie trete ich einer Gruppe bei?** Über „Gruppen entdecken“, und dann über eine Anfrage an die Gruppe selbst.\n\n**Kann ich meinen Namen ändern?** Nein. Der Name bleibt, damit ein alter Beitrag noch derselben Person gehört.\n\n**Wie lösche ich eine Gruppe?** Gar nicht — eine Gruppe verschwindet, sobald die letzte Person sie verlässt.\n\n**Wo finde ich Mitschreibende?** Unter „Storyideen“. Dafür ist das Forum nicht der Ort.",
  },
  {
    id: pageId(20),
    title: "Linksammlung",
    by: USER.lesezeichen,
    in: folderId(16),
    // The one page a member may edit: everything else is closed by its folder or by itself, so
    // without this nothing shows a page carrying „Seite bearbeiten" rather than the read-only note.
    text:
      "Was hier hineingehört: Wörterbücher, Namenslisten, alles, was beim Schreiben hilft. Ergänzen darf jede und jeder.\n\nNoch ziemlich leer. Trag ein, was du benutzt.",
  },
  {
    id: pageId(18),
    title: "Infos & Regeln",
    by: USER.tintenfleck,
    in: folderId(14),
    // Read inside a folder that grants `write`, which is the case a member could not otherwise
    // see: the room is open, this one page is not.
    may: "read",
    text:
      "Ein Beitrag pro Person, höchstens tausend Wörter, bis zum 31. August.\n\nThema ist „ein Ort, an dem niemand mehr wohnt“. Gewertet wird von allen, die mitgeschrieben haben.",
  },
  {
    id: pageId(19),
    title: "Werkstattnotizen",
    by: USER.tintenfleck,
    in: folderId(20),
    text:
      "Ideen für das nächste Forenspiel. Steht hier, solange der Ordner versteckt ist.",
  },
];
