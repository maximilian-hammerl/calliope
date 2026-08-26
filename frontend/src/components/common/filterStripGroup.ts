import type { InjectionKey } from 'vue'

/**
 * Whether a `FilterStrip` is inside a `FilterStrips`, and so shares its label column with the
 * strips around it rather than opening one of its own. Provided by `FilterStrips`; nothing else
 * should provide it.
 */
export const FILTER_STRIP_GROUP: InjectionKey<true> = Symbol('filterStripGroup')
