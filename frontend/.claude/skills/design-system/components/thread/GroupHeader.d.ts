import * as React from "react";

/**
 * Group title row above the tab strip: name in Newsreader 400, the visibility badge, and
 * the thread count. Privacy is stated HERE and nowhere else — repeating it in a rail was
 * called out as redundant.
 *
 * The thread count lives here rather than in the tab strip: a trailing item inside the
 * horizontal scroller scrolls out of sight. `threadLimit` surfaces the soft cap members
 * asked for against runaway tab creation.
 */
export interface GroupHeaderProps {
  name?: string;
  /** @default "Privat" */
  visibility?: "Privat" | "Öffentlich" | null;
  threadCount?: number;
  threadLimit?: number;
  /** Horizontal padding; use `var(--thread-gutter-mobile)` on small screens. */
  gutter?: string;
  /** Extra trailing content, e.g. a mobile "Gruppen-Kontext" sheet trigger. */
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export function GroupHeader(props: GroupHeaderProps): JSX.Element;
