import type { Selectable } from "kysely";
import type {
  StoryIdea as DatabaseStoryIdea,
  StoryLanguage,
} from "@/src/database/schema.ts";
import { USER } from "@/seed/accounts.ts";
import { storyIdeaId } from "@/seed/ids.ts";

/**
 * A fixture omits a column rather than writing null into it, so what it may leave out is optional
 * *and* never null — which `Partial<Pick<…>>` alone would not say.
 */
type Given<T, K extends keyof T> = { [P in K]?: NonNullable<T[P]> };

type StoryIdeaColumns = Selectable<DatabaseStoryIdea>;

/**
 * The columns come from the table, for the reason `GroupFixture` gives: a renamed column or a new
 * vocabulary is a compile error here rather than a field the seed quietly stops filling. `by` is
 * the only thing written out, because it is a username where the column is an id.
 */
export type StoryIdeaFixture =
  & Pick<StoryIdeaColumns, "id" | "title" | "teaser" | "synopsis">
  & Given<
    StoryIdeaColumns,
    | "subtitle"
    | "status"
    | "language"
    | "genres"
    | "subgenres"
    | "tropes"
    | "contentWarnings"
    | "storyThemes"
    | "storySettings"
    | "tense"
    | "perspective"
    | "lookingFor"
    | "partySize"
  >
  & { by: string };

/**
 * Six written-out ideas from six people, plus the run below. Only `open` and `closed` exist,
 * so the variety that matters is who wrote them, how many writers they want, and in which
 * language — which is what the board's filters are for.
 *
 * Every idea carries both texts, because both are required. These six have a synopsis in
 * several paragraphs, so the blank-line split on the idea's own page is always exercised.
 */
const WRITTEN_IDEAS: StoryIdeaFixture[] = [
  {
    id: storyIdeaId(1),
    title: "Briefe aus dem Leuchtturm",
    subtitle: "Zwei Wächter, eine See, die es nicht mehr gibt",
    teaser:
      "Zwei Leuchtturmwächter an entgegengesetzten Enden einer ausgetrockneten See " +
      "schreiben sich Briefe. Jeder Brief ist ein Beitrag; was die See verschwinden ließ, " +
      "entscheiden wir gemeinsam unterwegs.",
    synopsis:
      "Die See ist vor achtzehn Jahren verschwunden, an einem Nachmittag, den im Dorf " +
      "niemand beschreiben kann. Die beiden Türme stehen noch, und weil die Verwaltung sie " +
      "nicht abschreiben mag, sitzt in jedem ein Wächter und führt Protokoll über ein " +
      "Wasser, das es nicht gibt.\n\n" +
      "Die Briefe fangen dienstlich an. Sie werden länger, sie werden ungenauer, und " +
      "irgendwann schreibt einer von beiden etwas hin, das im Protokoll nichts zu suchen " +
      "hat. Was die See genommen hat, steht in keinem der beiden Hefte — wir schreiben es " +
      "uns gegenseitig zu.",
    genres: ["fantasy"],
    tropes: ["epistolary", "slow_burn"],
    tense: "past",
    lookingFor: "Eine Person, die den zweiten Wächter schreibt.",
    partySize: "one_on_one",
    by: USER.zeilensprung,
  },
  {
    id: storyIdeaId(2),
    title: "Die Leiden des jungen Lektors",
    teaser:
      "Ein Lektorat, das nur nach Einbruch der Dunkelheit öffnet — inzwischen eine Gruppe.",
    synopsis:
      "Das Lektorat im Erdgeschoss öffnet um zehn Uhr abends und schließt, wenn das letzte " +
      "Manuskript gelesen ist. Wer dort arbeitet, hat sich nie beworben: die Stellen werden " +
      "vererbt, und die Manuskripte kommen ohne Absender.\n\n" +
      "Wir sind inzwischen vollständig und schreiben abwechselnd je einen Abend.",
    genres: ["fantasy", "mystery"],
    status: "closed",
    by: USER.tintenfleck,
  },
  {
    id: storyIdeaId(3),
    title: "Das Dorf ohne Mittwoch",
    teaser:
      "In einem Dorf fehlt ein Wochentag, und niemand weiß mehr, wer ihn zuletzt gesehen hat. " +
      "Offen für alle, die eine Woche gern durchzählen.",
    synopsis:
      "Zwischen Dienstag und Donnerstag liegt nichts. Die Kalender in der Kirche sind sechs " +
      "Tage lang, die Kinder lernen die Woche so, und wer von außen kommt, zählt zweimal " +
      "nach und schweigt dann höflich.\n\n" +
      "Es gibt Leute, die sich an den Mittwoch erinnern wollen, und Leute, die genau deshalb " +
      "dageblieben sind. Drei oder vier Erzählstimmen, jede aus einem anderen Haushalt, und " +
      "keine muss der anderen glauben.",
    lookingFor: "Drei oder vier Leute, gern auch beim ersten Mal.",
    partySize: "group",
    by: USER.randnotiz,
  },
  {
    id: storyIdeaId(4),
    title: "The Passable Gatsby",
    subtitle: "A perfectly adequate summer",
    teaser:
      "A man throws mid-sized parties across the bay from someone he almost remembers. " +
      "Written in English, one letter per chapter.",
    synopsis:
      "Every second Saturday there are lights across the bay, a reasonable number of cars, " +
      "and a host who greets everybody by a name that is nearly theirs. He is waiting for " +
      "one person in particular, and he is no longer certain what she looked like.\n\n" +
      "One letter per chapter, alternating: the narrator writes what he sees, the host " +
      "writes what he intends. Neither of them reads the other's letters, which is the point.",
    language: "english",
    genres: ["literary"],
    tense: "past",
    lookingFor: "One writer for the narrator. I will take the host.",
    partySize: "one_on_one",
    by: USER.silbenmeer,
  },
  {
    id: storyIdeaId(5),
    title: "Brave New Draft",
    subtitle: "Everybody edits everybody",
    teaser:
      "A society where every text is rewritten by committee until nobody can find the first " +
      "sentence. Looking for a group; we will need the noise.",
    synopsis:
      "Publication is a committee. A sentence is submitted, revised by seven readers, " +
      "revised again by the readers of that revision, and released once no further " +
      "objection is recorded. The archive holds every version. Nobody has located a first " +
      "draft since the practice began.\n\n" +
      "Four to six writers, one chapter each, then we hand the chapter on and rewrite what " +
      "we were given. Whatever survives the round trip is the story.",
    language: "english",
    genres: ["science_fiction", "comedy"],
    subgenres: ["dystopian"],
    tropes: ["unreliable_narrator", "forced_proximity"],
    contentWarnings: ["discrimination"],
    tense: "present",
    perspective: "mixed",
    lookingFor: "Four to six writers, one chapter each, then we swap.",
    partySize: "group",
    by: USER.federkiel,
  },
  {
    id: storyIdeaId(6),
    title: "Im Westen nichts Notiert",
    teaser:
      "Ein Feldpostheft, in dem nur die belanglosen Tage aufgeschrieben wurden. " +
      "Wir sind inzwischen vollständig.",
    synopsis:
      "Das Heft enthält Wetter, Essen, Kartenspiele und die Namen von Hunden. Was zwischen " +
      "diesen Einträgen liegt, hat der Schreiber ausgelassen — nicht aus Vorsicht, sondern " +
      "weil es ihn nicht überraschte.\n\n" +
      "Wir schreiben die belanglosen Tage weiter und lassen dieselben Lücken.",
    status: "closed",
    genres: ["historical"],
    partySize: "group",
    by: USER.kommafehler,
  },
];

/**
 * Enough further ideas that both destinations page for `tintenfleck`: ten of their own, so
 * "Meine Storyideen" holds eleven with the closed one above, and seven from other members, so
 * the board they discover holds eleven that are not theirs. Discovery lists only `open` ideas
 * and hides your own, which is why both numbers have to be built rather than assumed.
 *
 * One-line teasers with a synopsis of a sentence or two, which is the ordinary shape: the
 * six above are the ones written out at length.
 */
const FURTHER_IDEAS: ReadonlyArray<
  {
    title: string;
    teaser: string;
    synopsis: string;
    by: string;
    language?: StoryLanguage;
  }
> = [
  {
    title: "Der Kartograf der Nebentäler",
    teaser:
      "Er zeichnet Täler, die es erst gibt, wenn sie auf der Karte stehen.",
    synopsis:
      "Er beliefert eine Behörde, die Karten kauft, ohne sie zu prüfen. Was er einzeichnet, " +
      "wird begangen, besiedelt und irgendwann besteuert; was er weglässt, findet niemand " +
      "mehr. Seit einem Jahr zeichnet er ein Tal, in dem er selbst wohnen will.",
    by: USER.tintenfleck,
  },
  {
    title: "Sieben Briefe an den Süden",
    teaser:
      "Sieben Absender, ein Empfänger, der nie antwortet. Jeder Brief ein Beitrag.",
    synopsis:
      "Sieben Menschen schreiben an dieselbe Adresse in einer Stadt, die keiner von ihnen " +
      "gesehen hat. Der Empfänger antwortet nie, und mit jedem Brief wird deutlicher, dass " +
      "sie alle über verschiedene Personen schreiben.",
    by: USER.tintenfleck,
  },
  {
    title: "Das Haus, das sich erinnert",
    teaser:
      "Wer einzieht, findet die Möbel dort, wo er sie als Kind gelassen hätte.",
    synopsis:
      "Das Haus stellt die Möbel so, wie der Einziehende sie als Kind hatte — auch die, an " +
      "die er sich nicht erinnern will. Es meint das freundlich, und es hört nicht auf, wenn " +
      "man es bittet.",
    by: USER.tintenfleck,
  },
  {
    title: "Nachtschicht im Leuchtturmcafé",
    teaser:
      "Zwischen zwei und vier kommen nur Leute herein, die es nicht mehr gibt.",
    synopsis:
      "Die Schicht zwischen zwei und vier gehört einer Kellnerin, die nie fragt und immer " +
      "aufschreibt. Die Gäste bestellen, was es seit Jahren nicht mehr gibt, und bezahlen " +
      "mit Geld, das keine Bank annimmt.",
    by: USER.tintenfleck,
  },
  {
    title: "Die Sammlerin verlorener Wörter",
    teaser:
      "Sie kauft Wörter auf, die niemand mehr benutzt, und verkauft sie teuer weiter.",
    synopsis:
      "Sie kauft Wörter, bevor das letzte Ohr sie vergisst, und führt Buch über Preise, die " +
      "niemand kontrolliert. Ein Käufer will jetzt ein Wort zurück, das sie längst " +
      "weiterverkauft hat.",
    by: USER.tintenfleck,
  },
  {
    title: "Was der Fluss zurückbringt",
    teaser:
      "Jedes Frühjahr legt der Fluss etwas ans Ufer, das jemandem gehört hat.",
    synopsis:
      "Jedes Frühjahr liegt etwas am Ufer, das jemandem gehört hat, und das Dorf hat sich " +
      "darauf geeinigt, nicht nachzufragen. Dieses Jahr trägt der Fund einen Namen.",
    by: USER.tintenfleck,
  },
  {
    title: "Zwei Uhren, eine Stadt",
    teaser:
      "Die Stadt hat zwei Uhren, und sie gehen seit dem Krieg verschieden.",
    synopsis:
      "Die Uhr am Rathaus und die Uhr am Bahnhof gehen elf Minuten auseinander, und beide " +
      "Seiten der Stadt richten sich nach der ihren. Wer pünktlich sein will, muss sich " +
      "entscheiden, wohin er gehört.",
    by: USER.tintenfleck,
  },
  {
    title: "The Quiet Cartographer",
    teaser: "A mapmaker who leaves one street off every map, and why.",
    synopsis:
      "One street is missing from every map he has ever drawn. The omission is deliberate, " +
      "and it is not the same street twice. The survey office has finally noticed.",
    by: USER.tintenfleck,
    language: "english",
  },
  {
    title: "Der Winter, der nicht kam",
    teaser:
      "Ein Dorf wartet auf den Schnee, der ausbleibt, und beginnt sich zu streiten.",
    synopsis:
      "Der Schnee bleibt aus, die Vorräte reichen, und weil nichts passiert, fangen die " +
      "Leute an, sich an Dinge zu erinnern, die sie einander schulden. Im März steht das " +
      "Dorf immer noch grün da.",
    by: USER.tintenfleck,
  },
  {
    title: "Anleitung zum Verschwinden",
    teaser: "In zwölf Kapiteln, von denen elf gelogen sind.",
    synopsis:
      "Zwölf Kapitel, elf davon gelogen, und das wahre ist nicht gekennzeichnet. Wer der " +
      "Anleitung folgt, verschwindet zuverlässig — nur nicht dorthin, wo er es vorhatte.",
    by: USER.tintenfleck,
  },
  {
    title: "Die Bibliothek der ungelesenen Bücher",
    teaser:
      "Jedes Buch darin wartet auf genau eine Leserin. Wir schreiben, wie es sie findet.",
    synopsis:
      "Kein Buch hier ist je aufgeschlagen worden, und jedes wartet auf genau eine Leserin. " +
      "Die Bibliothekarin kennt die Zuordnung und darf sie nicht verraten; wir schreiben, " +
      "wie die Bücher es trotzdem versuchen.",
    by: USER.lesezeichen,
  },
  {
    title: "Zwischen zwei Seiten",
    teaser:
      "Was in einem geliehenen Buch liegen bleibt, erzählt die Geschichte davor.",
    synopsis:
      "Ein Fahrschein, eine Haarnadel, ein halber Brief: was in geliehenen Büchern liegen " +
      "bleibt, ist die Geschichte, für die sich niemand Zeit genommen hat. Wir erzählen sie " +
      "von den Fundstücken aus, ein Buch pro Beitrag.",
    by: USER.lesezeichen,
  },
  {
    title: "Um drei Uhr schreibt niemand",
    teaser: "Vier Leute, vier Städte, dieselbe schlaflose Stunde.",
    synopsis:
      "Vier Leute in vier Städten sind zur selben Stunde wach und schreiben sich, weil " +
      "sonst nichts geöffnet hat. Keiner erzählt, warum er nicht schläft, und alle vier " +
      "merken, dass sie dieselbe Ausrede benutzen.",
    by: USER.nachtschreiber,
  },
  {
    title: "Die Stadt bei Nacht, dreistimmig",
    teaser:
      "Dieselbe Nacht aus drei Blickwinkeln, die sich nur einmal berühren.",
    synopsis:
      "Eine Nacht, drei Erzählstimmen, ein einziger Moment, in dem sie sich berühren, ohne " +
      "es zu bemerken. Wer ihn schreibt, entscheidet, was die anderen beiden falsch " +
      "verstanden haben.",
    by: USER.nachtschreiber,
  },
  {
    title: "Gezeitenrechnung",
    teaser:
      "Eine Insel, die alle sechs Stunden zur Halbinsel wird, und wer das ausnutzt.",
    synopsis:
      "Sechs Stunden Insel, sechs Stunden Halbinsel: wer den Fahrplan kennt, kann etwas " +
      "hinbringen, das dort nicht bleiben soll. Der Zoll hat den Fahrplan auch.",
    by: USER.silbenmeer,
  },
  {
    title: "Ein Absatz zu weit",
    teaser: "Eine Lektorin streicht eine Figur, und die Figur merkt es.",
    synopsis:
      "Die Lektorin streicht eine Nebenfigur, ordentlich, mit Begründung am Rand. Die Figur " +
      "liest die Begründung und antwortet in derselben Handschrift.",
    by: USER.zeilensprung,
  },
  {
    title: "Am Rand notiert",
    teaser: "Zwei Studierende schreiben sich über Jahre nur in Buchrändern.",
    synopsis:
      "Zwei Studierende leihen jahrelang dieselben Bände aus derselben Bibliothek und " +
      "schreiben sich ausschließlich in die Ränder. Sie begegnen sich nie, und einer von " +
      "beiden hört irgendwann auf.",
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
