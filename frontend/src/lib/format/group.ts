import type { Component } from 'vue'
import { Lock, LockOpen } from '@lucide/vue'
import type { GetGroup200 } from '@/api/models'

/** In one place, so the header's word and the mark's `aria-label` cannot drift apart. */
export const VISIBILITY_LABELS: Record<GetGroup200['visibility'], string> = {
  private: 'Privat',
  public: 'Öffentlich',
}

/** The glyph beside them, for the same reason: the header and the row both draw it. */
export const VISIBILITY_ICONS: Record<GetGroup200['visibility'], Component> = {
  private: Lock,
  public: LockOpen,
}

/**
 * Search widens past the groups you belong to, and nothing else on the row says which side of that
 * line a result is on. Absent for one you have not joined, which is the resting state.
 */
export const MEMBERSHIP_LABELS = {
  joined: 'Mitglied',
  invited: 'Eingeladen',
} as const
