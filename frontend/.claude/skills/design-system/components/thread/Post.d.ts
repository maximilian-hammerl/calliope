import * as React from "react";

/**
 * One post in a thread — the most important component in the system.
 *
 * Rules baked in, all of them from member feedback: no box and no card (round 1 was
 * rejected for boxing prose), but a full 1px `--border-divider` rule between posts
 * (round 2 asked for *some* separation); metadata recessed to 12px `--ink-6`, plain text,
 * no avatar and NO role badge next to the name; actions are plain text buttons;
 * annotations are collapsed behind a count. Prose renders through `.calliope-prose`
 * (Newsreader 17px/1.8) — never shrink it, not even on mobile.
 *
 * @startingPoint section="Thread" subtitle="Boxless post with recessed metadata" viewport="700x260"
 */
export interface PostProps {
  author?: string;
  /** "vor 12 Minuten" under a day, "Dienstag, 09:14" above it. */
  time?: string;
  /** Appends "· bearbeitet". @default false */
  edited?: boolean;
  /** Shows the "gemerkt" tag. @default false */
  bookmarked?: boolean;
  /** The prose. Use `<p>` elements. */
  children?: React.ReactNode;
  /** @default ["Antworten","Zitieren","Merken"] */
  actions?: string[];
  onAction?: (action: string) => void;
  /** Number of annotations; omit for none. */
  notesCount?: number;
  /** @default false */
  notesOpen?: boolean;
  onToggleNotes?: () => void;
  /** Draw the trailing divider. @default true */
  divider?: boolean;
  style?: React.CSSProperties;
}

export function Post(props: PostProps): JSX.Element;
