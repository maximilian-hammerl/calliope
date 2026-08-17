import * as React from "react";

export interface ThreadTabItem {
  id: string;
  name: string;
}

/**
 * Threads of the current group as a horizontally scrolling, sticky tab strip — the way
 * members asked to reach threads. The strip hides its scrollbar
 * (`.calliope-scroll-x`) so the active 2px underline stays flush with the bottom rule,
 * and NOTHING else may live inside the scroll container: counts and hints belong in the
 * group header instead.
 *
 * @startingPoint section="Navigation" subtitle="Sticky, scrollable thread tab strip" viewport="700x80"
 */
export interface ThreadTabsProps {
  threads?: ThreadTabItem[];
  activeId?: string;
  onSelect?: (id: string) => void;
  /** Omit to hide the create action. */
  onCreate?: () => void;
  /** @default "＋ Thread" */
  createLabel?: string;
  /** @default true */
  sticky?: boolean;
  /** Horizontal padding; pass `var(--thread-gutter-mobile)` on small screens. */
  gutter?: string;
  style?: React.CSSProperties;
}

export function ThreadTabs(props: ThreadTabsProps): JSX.Element;
