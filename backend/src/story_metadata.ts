import type { StoryGenre, StorySubgenre } from "@/src/database/schema.ts";

/**
 * Which genre each subgenre sits under. The form offers only the subgenres of the genres a member
 * picked — eight at most — which is what lets seventy-six be a usable list rather than a wall, and
 * why the values one member called unnecessary cost the others nothing.
 *
 * Romantasy is deliberately not a genre: it is Fantasy plus Romance, which are already selectable
 * together, and a mirrored subgenre list under it is what turns one crossover into a multiplying
 * one. The beta round's own Romantasy list was exactly that union.
 *
 * `satisfies` over the generated enums is the guarantee: a subgenre added to the migration and not
 * placed under a genre here fails to compile, rather than showing up under nothing in the form.
 */
export const SUBGENRE_GENRE = {
  // Fantasy
  high_fantasy: "fantasy",
  dark_fantasy: "fantasy",
  urban_fantasy: "fantasy",
  portal_fantasy: "fantasy",
  fairy_tale: "fantasy",
  mythic_fantasy: "fantasy",
  paranormal_fantasy: "fantasy",
  time_travel_fantasy: "fantasy",

  // Science fiction
  space_opera: "science_fiction",
  cyberpunk: "science_fiction",
  dystopian: "science_fiction",
  post_apocalyptic: "science_fiction",
  time_travel: "science_fiction",
  first_contact: "science_fiction",

  // Retelling
  retold_book: "retelling",
  retold_movie: "retelling",
  retold_myth: "retelling",
  retold_saga: "retelling",
  retold_manga: "retelling",

  // Romance
  contemporary_romance: "romance",
  historical_romance: "romance",
  romantic_fantasy: "romance",
  forbidden_romance: "romance",
  cosy_romance: "romance",
  comedy_romance: "romance",
  closed_door_romance: "romance",
  erotic_romance: "romance",

  // Mystery
  intrigue: "mystery",
  detective: "mystery",
  cosy_mystery: "mystery",
  noir: "mystery",
  whodunit: "mystery",

  // Crime
  heist: "crime",
  organised_crime: "crime",
  police_procedural: "crime",

  // Thriller
  psychological_thriller: "thriller",
  spy_thriller: "thriller",
  legal_thriller: "thriller",
  survival_thriller: "thriller",

  // Horror
  gothic_horror: "horror",
  supernatural_horror: "horror",
  psychological_horror: "horror",
  creature_horror: "horror",
  body_horror: "horror",
  doll_horror: "horror",

  // Historical
  ancient_world: "historical",
  medieval: "historical",
  early_modern: "historical",
  victorian: "historical",
  world_war: "historical",
  twentieth_century: "historical",

  // Adventure
  quest: "adventure",
  exploration: "adventure",
  treasure_hunt: "adventure",
  survival_adventure: "adventure",

  // Action
  military_action: "action",
  martial_arts: "action",
  superhero: "action",
  spy_action: "action",

  // Comedy
  romantic_comedy: "comedy",
  satire: "comedy",
  parody: "comedy",
  dark_comedy: "comedy",

  // Drama
  family_drama: "drama",
  coming_of_age: "drama",
  tragedy: "drama",

  // Slice of life
  everyday_life: "slice_of_life",
  workplace: "slice_of_life",
  school_life: "slice_of_life",
  university_life: "slice_of_life",
  family_life: "slice_of_life",
  vacation: "slice_of_life",

  // Western
  classic_western: "western",
  weird_western: "western",

  // Literary
  magical_realism: "literary",
  experimental: "literary",
} as const satisfies Record<StorySubgenre, StoryGenre>;

export function subgenresOf(genre: StoryGenre): StorySubgenre[] {
  return (Object.keys(SUBGENRE_GENRE) as StorySubgenre[]).filter(
    (subgenre) => SUBGENRE_GENRE[subgenre] === genre,
  );
}

/**
 * The subgenres that sit under no chosen genre. Empty when the pair is coherent.
 *
 * The interface only ever offers the subgenres of a genre already picked, so it cannot produce
 * one — but nothing else stopped a request from storing `romance` with `space_opera`, and such a
 * group is then unreachable by the one filter that offers that subgenre: seeing the chip at all
 * means having picked Science-Fiction, which the group does not carry.
 */
export function subgenresOutsideGenres(
  genres: readonly StoryGenre[],
  subgenres: readonly StorySubgenre[],
): StorySubgenre[] {
  const chosen = new Set<StoryGenre>(genres);

  return subgenres.filter((subgenre) => !chosen.has(SUBGENRE_GENRE[subgenre]));
}
