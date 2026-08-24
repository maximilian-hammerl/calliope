/**
 * The five kinds a favourite can name. Orval writes the union inline into every generated
 * signature rather than exporting a model for a path parameter, so it is named once here instead
 * of being retyped at each call site.
 */
export type SetFavouriteTargetType =
  | 'writing_group'
  | 'writing_thread'
  | 'writing_post'
  | 'story_idea'
  | 'chat_group'
