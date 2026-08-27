import type { setFavourite } from '@/api/favourites/favourites'

/**
 * Derived rather than retyped: Orval writes the union inline into every generated signature instead
 * of exporting a model for a path parameter, so a sixth kind would otherwise have to be copied here
 * by hand. Naming it once keeps call sites readable.
 */
export type SetFavouriteTargetType = Parameters<typeof setFavourite>[0]
