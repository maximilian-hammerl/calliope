import * as React from "react";

export interface Step {
  id: string;
  text: string;
  /** Who added it — members asked to see this. */
  author?: string;
  done?: boolean;
}

/**
 * "Nächste Schritte" — the most praised feature in testing. It belongs to the GROUP, not
 * to a thread: the same list shows on every thread of that group.
 *
 * Only open steps are listed, with an "{n} offen" count; completed ones collapse behind
 * "Erledigt (n) ▸" so the rail cannot grow without bound, and the open list scrolls after
 * `visibleCount` rows.
 *
 * @startingPoint section="Group context" subtitle="Group-level next steps with collapsed done list" viewport="700x300"
 */
export interface StepListProps {
  steps?: Step[];
  onToggle?: (id: string) => void;
  /** Omit to hide the add action. */
  onAdd?: () => void;
  /** @default false */
  doneOpen?: boolean;
  onToggleDone?: () => void;
  /** Rows before the open list starts scrolling. @default 4 */
  visibleCount?: number;
  /** @default "Nächste Schritte" */
  title?: string;
  style?: React.CSSProperties;
}

export function StepList(props: StepListProps): JSX.Element;
