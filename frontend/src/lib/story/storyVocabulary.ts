import type {
  GetGroup200ContentWarningsItem,
  GetGroup200GenresItem,
  GetGroup200Perspective,
  GetGroup200SubgenresItem,
  GetGroup200Tense,
  GetGroup200TropesItem,
} from '@/api/models'

/**
 * The German for every story value, and the only place any of it is written. The API carries the
 * value and never the label — the rule `notificationText.ts` and `sessionDevice.ts` already follow,
 * and what lets a genre be reworded here without a migration.
 *
 * Orval copies each enum per operation, so the read model is aliased once and everything is typed
 * against it: a value added to the migration and left without a German word fails to compile.
 */
export type Genre = GetGroup200GenresItem
export type Subgenre = GetGroup200SubgenresItem
export type Trope = GetGroup200TropesItem
export type ContentWarning = GetGroup200ContentWarningsItem
export type Tense = NonNullable<GetGroup200Tense>
export type Perspective = NonNullable<GetGroup200Perspective>

export const GENRE_LABELS: Record<Genre, string> = {
  action: 'Action',
  adventure: 'Abenteuer',
  comedy: 'Komödie',
  crime: 'Krimi',
  drama: 'Drama',
  fantasy: 'Fantasy',
  historical: 'Historisch',
  horror: 'Horror',
  literary: 'Literarisch',
  mystery: 'Mystery',
  retelling: 'Nacherzählung',
  romance: 'Romanze',
  science_fiction: 'Science-Fiction',
  slice_of_life: 'Alltagsgeschichte',
  thriller: 'Thriller',
  western: 'Western',
}

/**
 * Flat and exhaustive, separate from the grouping below so both can be checked. Nested inside it
 * the subgenre maps could only be `Partial`, and a value without a word would have reached a page
 * as `doll_horror`.
 */
export const SUBGENRE_LABELS: Record<Subgenre, string> = {
  military_action: 'Militäraction',
  martial_arts: 'Kampfkunst',
  superhero: 'Superhelden',
  spy_action: 'Spionageaction',
  quest: 'Queste',
  exploration: 'Entdeckungsreise',
  treasure_hunt: 'Schatzsuche',
  survival_adventure: 'Survival-Abenteuer',
  romantic_comedy: 'Romantische Komödie',
  satire: 'Satire',
  parody: 'Parodie',
  dark_comedy: 'Schwarze Komödie',
  heist: 'Raubzug',
  organised_crime: 'Organisierte Kriminalität',
  police_procedural: 'Polizeikrimi',
  family_drama: 'Familiendrama',
  coming_of_age: 'Coming-of-Age',
  tragedy: 'Tragödie',
  high_fantasy: 'High Fantasy',
  dark_fantasy: 'Dark Fantasy',
  urban_fantasy: 'Urban Fantasy',
  portal_fantasy: 'Portalfantasy',
  fairy_tale: 'Märchen',
  mythic_fantasy: 'Mythenfantasy',
  paranormal_fantasy: 'Paranormale Fantasy',
  time_travel_fantasy: 'Zeitreise-Fantasy',
  ancient_world: 'Antike',
  medieval: 'Mittelalter',
  early_modern: 'Frühe Neuzeit',
  victorian: 'Viktorianische Zeit',
  world_war: 'Weltkriege',
  twentieth_century: '20. Jahrhundert',
  gothic_horror: 'Schauerroman',
  supernatural_horror: 'Übernatürlicher Horror',
  psychological_horror: 'Psychologischer Horror',
  creature_horror: 'Monsterhorror',
  body_horror: 'Body Horror',
  doll_horror: 'Puppenhorror',
  magical_realism: 'Magischer Realismus',
  experimental: 'Experimentell',
  intrigue: 'Intrigen',
  detective: 'Detektivgeschichte',
  cosy_mystery: 'Cosy Crime',
  noir: 'Noir',
  whodunit: 'Whodunit',
  retold_book: 'Buch',
  retold_movie: 'Film',
  retold_myth: 'Mythen und Legenden',
  retold_saga: 'Sagen und Märchen',
  retold_manga: 'Manga',
  contemporary_romance: 'Gegenwartsromanze',
  historical_romance: 'Historische Romanze',
  romantic_fantasy: 'Romantische Fantasy',
  forbidden_romance: 'Verbotene Romanze',
  cosy_romance: 'Cosy Romance',
  comedy_romance: 'Komödien-Romanze',
  closed_door_romance: 'Implizierte Erotik',
  erotic_romance: 'Erotik',
  space_opera: 'Space Opera',
  cyberpunk: 'Cyberpunk',
  dystopian: 'Dystopie',
  post_apocalyptic: 'Postapokalyptisch',
  time_travel: 'Zeitreise',
  first_contact: 'Erstkontakt',
  everyday_life: 'Alltag',
  workplace: 'Arbeitswelt',
  school_life: 'Schulalltag',
  university_life: 'Unialltag',
  family_life: 'Familienalltag',
  vacation: 'Urlaub',
  psychological_thriller: 'Psychothriller',
  spy_thriller: 'Spionagethriller',
  legal_thriller: 'Justizthriller',
  survival_thriller: 'Survival-Thriller',
  classic_western: 'Klassischer Western',
  weird_western: 'Weird Western',
}

/**
 * Which subgenres sit under each genre. The form offers only those of a genre the member picked —
 * eight at most rather than seventy-six — which is what lets the list stay thorough for the person
 * who needs it and short for everyone else.
 */
export const GENRES: Record<Genre, { label: string; subgenres: readonly Subgenre[] }> = {
  action: {
    label: 'Action',
    subgenres: ['military_action', 'martial_arts', 'superhero', 'spy_action'],
  },
  adventure: {
    label: 'Abenteuer',
    subgenres: ['quest', 'exploration', 'treasure_hunt', 'survival_adventure'],
  },
  comedy: {
    label: 'Komödie',
    subgenres: ['romantic_comedy', 'satire', 'parody', 'dark_comedy'],
  },
  crime: {
    label: 'Krimi',
    subgenres: ['heist', 'organised_crime', 'police_procedural'],
  },
  drama: {
    label: 'Drama',
    subgenres: ['family_drama', 'coming_of_age', 'tragedy'],
  },
  fantasy: {
    label: 'Fantasy',
    subgenres: [
      'high_fantasy',
      'dark_fantasy',
      'urban_fantasy',
      'portal_fantasy',
      'fairy_tale',
      'mythic_fantasy',
      'paranormal_fantasy',
      'time_travel_fantasy',
    ],
  },
  historical: {
    label: 'Historisch',
    subgenres: [
      'ancient_world',
      'medieval',
      'early_modern',
      'victorian',
      'world_war',
      'twentieth_century',
    ],
  },
  horror: {
    label: 'Horror',
    subgenres: [
      'gothic_horror',
      'supernatural_horror',
      'psychological_horror',
      'creature_horror',
      'body_horror',
      'doll_horror',
    ],
  },
  literary: {
    label: 'Literarisch',
    subgenres: ['magical_realism', 'experimental'],
  },
  mystery: {
    label: 'Mystery',
    subgenres: ['intrigue', 'detective', 'cosy_mystery', 'noir', 'whodunit'],
  },
  retelling: {
    label: 'Nacherzählung',
    subgenres: ['retold_book', 'retold_movie', 'retold_myth', 'retold_saga', 'retold_manga'],
  },
  romance: {
    label: 'Romanze',
    subgenres: [
      'contemporary_romance',
      'historical_romance',
      'romantic_fantasy',
      'forbidden_romance',
      'cosy_romance',
      'comedy_romance',
      'closed_door_romance',
      'erotic_romance',
    ],
  },
  science_fiction: {
    label: 'Science-Fiction',
    subgenres: [
      'space_opera',
      'cyberpunk',
      'dystopian',
      'post_apocalyptic',
      'time_travel',
      'first_contact',
    ],
  },
  slice_of_life: {
    label: 'Alltagsgeschichte',
    subgenres: [
      'everyday_life',
      'workplace',
      'school_life',
      'university_life',
      'family_life',
      'vacation',
    ],
  },
  thriller: {
    label: 'Thriller',
    subgenres: ['psychological_thriller', 'spy_thriller', 'legal_thriller', 'survival_thriller'],
  },
  western: {
    label: 'Western',
    subgenres: ['classic_western', 'weird_western'],
  },
}

export const TROPE_LABELS: Record<Trope, string> = {
  enemies_to_lovers: 'Vom Feind zum Geliebten',
  friends_to_lovers: 'Von Freunden zu Liebenden',
  friends_with_benefits: 'Freundschaft plus',
  slow_burn: 'Langsame Annäherung',
  forbidden_love: 'Verbotene Liebe',
  love_triangle: 'Dreiecksbeziehung',
  fake_relationship: 'Vorgetäuschte Beziehung',
  second_chance: 'Zweite Chance',
  found_family: 'Wahlfamilie',
  chosen_one: 'Der Auserwählte',
  mentor_and_student: 'Mentor und Schüler',
  rivals: 'Rivalen',
  redemption_arc: 'Läuterung',
  villain_to_hero: 'Vom Bösewicht zum Helden',
  hero_to_villain: 'Vom Helden zum Bösewicht',
  hidden_identity: 'Verborgene Identität',
  secret_heritage: 'Geheime Herkunft',
  amnesia: 'Gedächtnisverlust',
  time_loop: 'Zeitschleife',
  quest_for_an_artefact: 'Suche nach einem Artefakt',
  heist_crew: 'Diebesbande',
  locked_room: 'Verschlossener Raum',
  forced_proximity: 'Erzwungene Nähe',
  grumpy_and_sunshine: 'Griesgram und Sonnenschein',
  unreliable_narrator: 'Unzuverlässiger Erzähler',
  epistolary: 'Briefroman',
  multiple_timelines: 'Mehrere Zeitebenen',
  ensemble_cast: 'Ensemble',
  morally_grey_protagonist: 'Moralisch ambivalente Hauptfigur',
  road_trip: 'Roadtrip',
  court_intrigue: 'Hofintrigen',
}

export const CONTENT_WARNING_LABELS: Record<ContentWarning, string> = {
  violence: 'Gewalt',
  sexual_content: 'Sexuelle Inhalte',
  self_harm: 'Selbstverletzung',
  suicide: 'Suizid',
  death: 'Tod',
  grief: 'Trauer',
  abuse: 'Missbrauch',
  sexual_violence: 'Sexualisierte Gewalt',
  substance_abuse: 'Substanzmissbrauch',
  eating_disorder: 'Essstörung',
  mental_illness: 'Psychische Erkrankung',
  discrimination: 'Diskriminierung',
  gore: 'Explizite Gewaltdarstellung',
  war: 'Krieg',
  animal_cruelty: 'Tierquälerei',
  pregnancy_loss: 'Fehlgeburt',
}

export const TENSE_LABELS: Record<Tense, string> = {
  past: 'Vergangenheit',
  present: 'Gegenwart',
  mixed: 'Gemischt',
}

export const PERSPECTIVE_LABELS: Record<Perspective, string> = {
  first_person: 'Erste Person',
  second_person: 'Zweite Person',
  third_person_limited: 'Dritte Person (begrenzt)',
  third_person_omniscient: 'Dritte Person (allwissend)',
  mixed: 'Gemischt',
}

/** The subgenres on offer for the genres a member has picked, in the order the genres are listed. */
export function subgenresFor(genres: readonly Genre[]): Array<{ value: Subgenre; label: string }> {
  return (Object.keys(GENRES) as Genre[])
    .filter((genre) => genres.includes(genre))
    .flatMap((genre) =>
      GENRES[genre].subgenres.map((value) => ({ value, label: SUBGENRE_LABELS[value] })),
    )
}

/**
 * A chosen list as one German line, or nothing when there is none — so a caller drops the whole row
 * rather than printing an empty one. One of these per kind rather than a generic over strings,
 * because the values are tokens: anything that forgets to translate renders `high_fantasy` at a
 * reader, and a typed helper is what makes that impossible rather than merely unlikely.
 */
const line = (labels: readonly string[]): string | undefined =>
  labels.length === 0 ? undefined : labels.join(', ')

export const genreLine = (values: readonly Genre[]) =>
  line(values.map((value) => GENRE_LABELS[value]))
export const subgenreLine = (values: readonly Subgenre[]) =>
  line(values.map((value) => SUBGENRE_LABELS[value]))
export const tropeLine = (values: readonly Trope[]) =>
  line(values.map((value) => TROPE_LABELS[value]))
export const contentWarningLine = (values: readonly ContentWarning[]) =>
  line(values.map((value) => CONTENT_WARNING_LABELS[value]))

/** What a board is narrowed by. Empty means "not asked", which is what the request omits. */
export type StoryVocabularySelection = {
  genres: Genre[]
  subgenres: Subgenre[]
  tropes: Trope[]
}

export const emptySelection = (): StoryVocabularySelection => ({
  genres: [],
  subgenres: [],
  tropes: [],
})

/**
 * The genres a member picked, with any subgenre whose genre has just gone dropped with it.
 *
 * One place, because both the form and the board filter need it and a copy that lost it would
 * store — or narrow by — a subgenre nobody can see any more.
 */
export function afterChoosingGenres<T extends { genres: Genre[]; subgenres: Subgenre[] }>(
  selection: T,
  chosen: Genre[],
): T {
  const offered = new Set(subgenresFor(chosen).map((option) => option.value))

  return {
    ...selection,
    genres: chosen,
    subgenres: selection.subgenres.filter((each) => offered.has(each)),
  }
}

/** Whether a board is being narrowed, which is what an empty list has to say for itself. */
export const isNarrowed = (selection: StoryVocabularySelection): boolean =>
  selection.genres.length > 0 || selection.subgenres.length > 0 || selection.tropes.length > 0
