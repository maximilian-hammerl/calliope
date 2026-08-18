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
   * bcrypt reads at most 72 bytes and silently ignores the rest, so a longer passphrase
   * would be weaker than it looks. Rejecting is honest; pre-hashing would lift the limit.
   * Note this counts characters, and an umlaut costs two bytes.
   */
  password: 72,
  /** A group title sits on one line beside its privacy badge. */
  groupTitle: 120,
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
