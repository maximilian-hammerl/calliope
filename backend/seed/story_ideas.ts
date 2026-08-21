import type {
  StoryIdeaPartySize,
  StoryIdeaStatus,
  StoryLanguage,
} from "@/src/database/schema.ts";
import { USER } from "@/seed/accounts.ts";
import { storyIdeaId } from "@/seed/ids.ts";

export type StoryIdeaFixture = {
  id: string;
  title: string;
  subtitle?: string;
  idea: string;
  status?: StoryIdeaStatus;
  language?: StoryLanguage;
  genres?: string[];
  subgenres?: string[];
  tropes?: string[];
  contentWarnings?: string[];
  tense?: string;
  perspective?: string;
  lookingFor?: string;
  partySize?: StoryIdeaPartySize;
  by: string;
};

/**
 * Six ideas from six people. Only `open` and `closed` exist, so the variety that matters is
 * who wrote them, how many writers they want, and in which language — which is what the
 * board's filters are for.
 */
export const STORY_IDEAS: StoryIdeaFixture[] = [
  {
    id: storyIdeaId(1),
    title: "Briefe aus dem Leuchtturm",
    subtitle: "Zwei Wächter, eine See, die es nicht mehr gibt",
    idea:
      "Zwei Leuchtturmwächter an entgegengesetzten Enden einer ausgetrockneten See " +
      "schreiben sich Briefe. Jeder Brief ist ein Beitrag; was die See verschwinden ließ, " +
      "entscheiden wir gemeinsam unterwegs.",
    genres: ["Fantasy"],
    tropes: ["Epistolary", "Slow Burn"],
    tense: "Vergangenheit",
    lookingFor: "Eine Person, die den zweiten Wächter schreibt.",
    partySize: "one_on_one",
    by: USER.zeilensprung,
  },
  {
    id: storyIdeaId(2),
    title: "Die Leiden des jungen Lektors",
    idea:
      "Ein Lektorat, das nur nach Einbruch der Dunkelheit öffnet — inzwischen eine Gruppe.",
    genres: ["Fantasy", "Mystery"],
    status: "closed",
    by: USER.tintenfleck,
  },
  {
    id: storyIdeaId(3),
    title: "Das Dorf ohne Mittwoch",
    idea:
      "In einem Dorf fehlt ein Wochentag, und niemand weiß mehr, wer ihn zuletzt gesehen hat. " +
      "Offen für alle, die eine Woche gern durchzählen.",
    lookingFor: "Drei oder vier Leute, gern auch beim ersten Mal.",
    partySize: "group",
    by: USER.randnotiz,
  },
  {
    id: storyIdeaId(4),
    title: "The Passable Gatsby",
    subtitle: "A perfectly adequate summer",
    idea:
      "A man throws mid-sized parties across the bay from someone he almost remembers. " +
      "Written in English, one letter per chapter.",
    language: "english",
    genres: ["Literary"],
    tense: "Vergangenheit",
    lookingFor: "One writer for the narrator. I will take the host.",
    partySize: "one_on_one",
    by: USER.silbenmeer,
  },
  {
    id: storyIdeaId(5),
    title: "Brave New Draft",
    subtitle: "Everybody edits everybody",
    idea:
      "A society where every text is rewritten by committee until nobody can find the first " +
      "sentence. Looking for a group; we will need the noise.",
    language: "english",
    genres: ["Science Fiction", "Satire"],
    subgenres: ["Dystopia"],
    tropes: ["Unreliable Narrator", "Kammerspiel"],
    contentWarnings: ["Überwachung"],
    tense: "Präsens",
    perspective: "Erste Person, wechselnd",
    lookingFor: "Four to six writers, one chapter each, then we swap.",
    partySize: "group",
    by: USER.federkiel,
  },
  {
    id: storyIdeaId(6),
    title: "Im Westen nichts Notiert",
    idea:
      "Ein Feldpostheft, in dem nur die belanglosen Tage aufgeschrieben wurden. " +
      "Wir sind inzwischen vollständig.",
    status: "closed",
    genres: ["Historisch"],
    partySize: "group",
    by: USER.kommafehler,
  },
];
