import type { GetGroup200 } from '@/api/models'

/**
 * German for the group's visibility, in one place: the header writes it out and the mark on a row
 * names its icon with it, and a member who read „Privat" on the page has to meet the same word
 * behind the lock in the list.
 */
export const VISIBILITY_LABELS: Record<GetGroup200['visibility'], string> = {
  private: 'Privat',
  public: 'Öffentlich',
}

/**
 * The reader's own standing in a group, for a search result. Search widens past the groups you
 * belong to — `membership: "any"` — and nothing else on the row says which side of that line a
 * result is on, while opening one you are in means you can write and the other means you can only
 * read.
 *
 * Absent for a group you have not joined: that is the board's own resting state, and „nicht
 * beigetreten" on most of a list of public groups would be noise. Slightly redundant on a private
 * group, since seeing one at all means you are in it — but a rule that fired on some visibilities
 * and not others is harder to trust than one that always means what it says.
 */
export const MEMBERSHIP_LABELS = {
  joined: 'Mitglied',
  invited: 'Eingeladen',
} as const
