import { USER } from "@/seed/accounts.ts";
import { pageId, postId, reportId, storyIdeaId } from "@/seed/ids.ts";
import type {
  ReportCategory,
  ReportOutcome,
  ReportTargetType,
} from "@/src/database/schema.ts";

/**
 * One report per state the queue can show, because the lifecycle is otherwise invisible: a fresh
 * checkout has an empty queue, and reaching `in_progress` or a closing with an outcome means
 * filing reports by hand and switching accounts for each one.
 *
 * Two of these exist only to make a state reachable that no amount of clicking produces — a report
 * whose target has been deleted, and one whose reporter has left. The same argument as `unverified`
 * among the accounts.
 *
 * The excerpt is a copy of what the target said when it was reported, so it is written out here
 * rather than looked up: that is the column's whole point, and one that agreed with the live row
 * by construction would hide the case where they differ.
 */
export type ReportFixture = {
  id: string;
  reporter: string | null;
  targetType: ReportTargetType;
  /** Null for a target that has since been deleted, which is what empties this column. */
  targetId: string | null;
  /** Who answers for it, which survives the target being deleted. */
  author: string | null;
  excerpt: string;
  category: ReportCategory;
  reason: string;
  /**
   * Where it has got to, and who has it. Absent is a report nobody has touched. A union for the
   * reason the route's own body is one: only a closing carries an outcome and a note.
   */
  progress?:
    | { operator: string; taken: true }
    | {
      operator: string;
      taken: boolean;
      outcome: ReportOutcome;
      note: string;
    };
};

export const REPORTS: ReadonlyArray<ReportFixture> = [
  // Untouched, and the ordinary case: a member reports somebody else's post in a public group.
  {
    id: reportId(1),
    reporter: USER.zeilensprung,
    targetType: "writing_post",
    targetId: postId(6),
    author: USER.tintenfleck,
    excerpt:
      "Oben empfing ihn ein Zwerg mit einer Liste. Sein Name stand nicht darauf.",
    category: "harassment",
    reason:
      "Der Beitrag spielt auf eine Diskussion im Forum an und wird persönlich.",
  },

  // A second, different claim about the same post by the same member — the shape the category in
  // the index key allows, and the queue shows as two rows rather than one overwritten.
  {
    id: reportId(2),
    reporter: USER.zeilensprung,
    targetType: "writing_post",
    targetId: postId(6),
    author: USER.tintenfleck,
    excerpt:
      "Oben empfing ihn ein Zwerg mit einer Liste. Sein Name stand nicht darauf.",
    category: "plagiarism",
    reason: "Die Stelle steht fast wörtlich in einem anderen Buch.",
  },

  // In somebody's hands, so "In Arbeit bei kommafehler" is on screen from the first run.
  {
    id: reportId(3),
    reporter: USER.lesezeichen,
    targetType: "story_idea",
    targetId: storyIdeaId(4),
    author: USER.silbenmeer,
    excerpt: "Ein Wettbewerb, bei dem alle gewinnen",
    category: "spam",
    reason: "Wirkt wie Werbung für eine fremde Seite.",
    progress: { operator: USER.kommafehler, taken: true },
  },

  // Closed as upheld, with the note the next operator to meet this reporter reads.
  {
    id: reportId(4),
    reporter: USER.randnotiz,
    targetType: "user",
    targetId: USER.silbenmeer,
    author: USER.silbenmeer,
    excerpt: "silbenmeer",
    category: "spam",
    reason: "Schreibt mehrere Mitglieder mit derselben Nachricht an.",
    progress: {
      operator: USER.federkiel,
      taken: true,
      outcome: "warning_given",
      note: "Angeschrieben, erste Verwarnung. Bei Wiederholung sperren.",
    },
  },

  // Closed as refused, which is what `dismissed` used to say and the outcome now says properly.
  {
    id: reportId(5),
    reporter: USER.nachtschreiber,
    targetType: "writing_post",
    targetId: postId(3),
    author: USER.randnotiz,
    excerpt:
      "Es ist eine allgemein anerkannte Wahrheit, dass ein Satz ohne Komma",
    category: "missing_content_warning",
    reason: "Ich hätte hier eine Warnung erwartet.",
    // Closed straight from the queue without being taken first, which leaves `in_progress_at`
    // null and still records who closed it.
    progress: {
      operator: USER.kommafehler,
      taken: false,
      outcome: "no_violation",
      note: "Nichts, was eine Warnung braucht. Mit dem Melder gesprochen.",
    },
  },

  // Taken by one operator and closed by them, which is the ordinary path and the one the queue
  // shows most: „In Arbeit bei …" first, then the outcome and the note.
  {
    id: reportId(6),
    reporter: USER.tintenfleck,
    targetType: "writing_post",
    targetId: postId(8),
    author: USER.nachtschreiber,
    excerpt: "Die Figuren sind noch Platzhalter, aber die Namen stimmen schon.",
    category: "plagiarism",
    reason: "Die Namen stammen aus einer laufenden Reihe.",
    progress: {
      operator: USER.kommafehler,
      taken: true,
      outcome: "insufficient_information",
      note: "Zu wenig Angaben, um das zu prüfen.",
    },
  },

  // The target is gone, so the queue's "Gelöscht" badge is visible without deleting seeded
  // content by hand. The excerpt is all that is left of it, which is why the column exists.
  {
    id: reportId(7),
    reporter: USER.lesezeichen,
    targetType: "chat_message",
    targetId: null,
    author: USER.silbenmeer,
    excerpt:
      "Schau mal hier vorbei, lohnt sich wirklich: gewinne-jetzt.example",
    category: "spam",
    reason: "Fremder Link in einer Direktnachricht.",
  },

  // The reporter has left, so "Ein gelöschtes Konto meldet" is on screen without deleting an
  // account mid-session. The report stays: deleting your account does not withdraw it.
  {
    id: reportId(8),
    reporter: null,
    targetType: "writing_post",
    targetId: postId(4),
    author: USER.kommafehler,
    excerpt: "Zweiter Beitrag, damit der Thread nicht allein steht.",
    category: "other",
    reason:
      "Ich weiß nicht, in welche Kategorie das gehört, aber es stört mich.",
  },

  // A page, so the queue holds the kind whose excerpt is prose rather than a title.
  {
    id: reportId(9),
    reporter: USER.zeilensprung,
    targetType: "writing_page",
    targetId: pageId(2),
    author: USER.tintenfleck,
    excerpt: "Ein Kino mit zwei Sälen, von denen einer immer geschlossen ist.",
    category: "other",
    reason:
      "Die Seite beschreibt einen Ort, den es in der Geschichte so nicht geben soll.",
  },
];
