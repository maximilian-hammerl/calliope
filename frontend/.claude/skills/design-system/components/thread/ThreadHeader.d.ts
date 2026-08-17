import * as React from "react";

/**
 * Thread title, activity line and the collapsed post filter. The filter is ONE menu
 * button ("Alle Beiträge ▾"), not a row of chips — the chip row was judged too prominent
 * and its labels ("Nur Story") were not understood. Never show a word count here.
 */
export interface ThreadHeaderProps {
  title?: string;
  postCount?: number;
  /** Relative or absolute, e.g. "vor 12 Minuten". */
  lastActivity?: string;
  lastAuthor?: string;
  /** Current filter label. @default "Alle Beiträge" */
  filter?: string;
  /** Omit to hide the filter menu. */
  onFilter?: () => void;
  style?: React.CSSProperties;
}

export function ThreadHeader(props: ThreadHeaderProps): JSX.Element;
