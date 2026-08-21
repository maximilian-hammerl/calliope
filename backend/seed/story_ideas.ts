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
 * Six written-out ideas from six people, plus the run below. Only `open` and `closed` exist,
 * so the variety that matters is who wrote them, how many writers they want, and in which
 * language — which is what the board's filters are for.
 */
const WRITTEN_IDEAS: StoryIdeaFixture[] = [
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

/**
 * Enough further ideas that both destinations page for `tintenfleck`: ten of their own, so
 * "Meine Storyideen" holds eleven with the closed one above, and seven from other members, so
 * the board they discover holds eleven that are not theirs. Discovery lists only `open` ideas
 * and hides your own, which is why both numbers have to be built rather than assumed.
 */
const FURTHER_IDEAS: ReadonlyArray<
  { title: string; idea: string; by: string; language?: StoryLanguage }
> = [
  {
    title: "Der Kartograf der Nebentäler",
    idea: "Er zeichnet Täler, die es erst gibt, wenn sie auf der Karte stehen.",
    by: USER.tintenfleck,
  },
  {
    title: "Sieben Briefe an den Süden",
    idea:
      "Sieben Absender, ein Empfänger, der nie antwortet. Jeder Brief ein Beitrag.",
    by: USER.tintenfleck,
  },
  {
    title: "Das Haus, das sich erinnert",
    idea:
      "Wer einzieht, findet die Möbel dort, wo er sie als Kind gelassen hätte.",
    by: USER.tintenfleck,
  },
  {
    title: "Nachtschicht im Leuchtturmcafé",
    idea:
      "Zwischen zwei und vier kommen nur Leute herein, die es nicht mehr gibt.",
    by: USER.tintenfleck,
  },
  {
    title: "Die Sammlerin verlorener Wörter",
    idea:
      "Sie kauft Wörter auf, die niemand mehr benutzt, und verkauft sie teuer weiter.",
    by: USER.tintenfleck,
  },
  {
    title: "Was der Fluss zurückbringt",
    idea:
      "Jedes Frühjahr legt der Fluss etwas ans Ufer, das jemandem gehört hat.",
    by: USER.tintenfleck,
  },
  {
    title: "Zwei Uhren, eine Stadt",
    idea: "Die Stadt hat zwei Uhren, und sie gehen seit dem Krieg verschieden.",
    by: USER.tintenfleck,
  },
  {
    title: "The Quiet Cartographer",
    idea: "A mapmaker who leaves one street off every map, and why.",
    by: USER.tintenfleck,
    language: "english",
  },
  {
    title: "Der Winter, der nicht kam",
    idea:
      "Ein Dorf wartet auf den Schnee, der ausbleibt, und beginnt sich zu streiten.",
    by: USER.tintenfleck,
  },
  {
    title: "Anleitung zum Verschwinden",
    idea: "In zwölf Kapiteln, von denen elf gelogen sind.",
    by: USER.tintenfleck,
  },
  {
    title: "Die Bibliothek der ungelesenen Bücher",
    idea:
      "Jedes Buch darin wartet auf genau eine Leserin. Wir schreiben, wie es sie findet.",
    by: USER.lesezeichen,
  },
  {
    title: "Zwischen zwei Seiten",
    idea:
      "Was in einem geliehenen Buch liegen bleibt, erzählt die Geschichte davor.",
    by: USER.lesezeichen,
  },
  {
    title: "Um drei Uhr schreibt niemand",
    idea: "Vier Leute, vier Städte, dieselbe schlaflose Stunde.",
    by: USER.nachtschreiber,
  },
  {
    title: "Die Stadt bei Nacht, dreistimmig",
    idea: "Dieselbe Nacht aus drei Blickwinkeln, die sich nur einmal berühren.",
    by: USER.nachtschreiber,
  },
  {
    title: "Gezeitenrechnung",
    idea:
      "Eine Insel, die alle sechs Stunden zur Halbinsel wird, und wer das ausnutzt.",
    by: USER.silbenmeer,
  },
  {
    title: "Ein Absatz zu weit",
    idea: "Eine Lektorin streicht eine Figur, und die Figur merkt es.",
    by: USER.zeilensprung,
  },
  {
    title: "Am Rand notiert",
    idea: "Zwei Studierende schreiben sich über Jahre nur in Buchrändern.",
    by: USER.randnotiz,
  },
];

export const STORY_IDEAS: StoryIdeaFixture[] = [
  ...WRITTEN_IDEAS,
  ...FURTHER_IDEAS.map((idea, index) => ({
    id: storyIdeaId(20 + index),
    ...idea,
  })),
];
