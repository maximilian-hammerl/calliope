/**
 * Upper bounds for everything a member can type. Without them a single request can store
 * megabytes: the API accepted and stored a 20 MB post before these existed.
 *
 * The database columns are all `text` and enforce nothing, so these are the only limit.
 * Kept together rather than at each route so the numbers can be compared and changed as a
 * set — the API and the interface have to agree on them.
 */
export const TEXT_LIMIT = {
  /** Fits a rail row and an avatar's title without wrapping. */
  username: 32,
  /** The longest address SMTP has to accept, RFC 5321 §4.5.3.1.3. */
  emailAddress: 254,
  /**
   * scrypt reads the whole input, so unlike bcrypt — which stopped at 72 bytes and silently
   * ignored the rest — a long passphrase is worth what it looks like. The bound is here only
   * to keep the hashing input finite.
   */
  password: 256,
  /** A group title sits on one line beside its privacy badge. */
  groupTitle: 120,
  /** Long enough for any name or title being looked for, short enough to bound the scan. */
  search: 120,
  /** A few paragraphs about the story, not the story itself. */
  groupDescription: 2_000,
  threadTitle: 120,
  /** Roughly a long chapter. Posts are long-form prose, so this is deliberately generous. */
  postText: 100_000,
} as const;

/**
 * Ceiling on any request body, as a second line of defence: the limits above only apply
 * once a body has been read and parsed, and this stops an oversized one being buffered at
 * all. Comfortably above the largest legitimate request, which is a full-length post.
 */
export const REQUEST_BODY_LIMIT_BYTES = 1_048_576;

/**
 * Lower bounds, where a value that is merely non-empty would be useless.
 */
export const TEXT_MINIMUM = {
  /**
   * Matched to the search minimum below: a shorter username could be registered and then
   * never turn up in a search, which would make its owner impossible to invite.
   */
  username: 3,
  /**
   * A search term shorter than this is close enough to no filter at all, and would let the
   * user list be walked page by page — the thing a directory of a private platform must not
   * allow.
   */
  search: 3,
} as const;
