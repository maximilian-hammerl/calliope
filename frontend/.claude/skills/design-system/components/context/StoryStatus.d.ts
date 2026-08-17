import * as React from "react";

export interface StatusField {
  /** e.g. "Status", "Genre", "Perspektive" */
  label: string;
  value: string;
  /** Emphasise the value (used for "Wird geschrieben"). */
  strong?: boolean;
}

/**
 * The group's standing facts — status, genre, narrative perspective. Group-level, shown
 * identically on every thread. This is also where the standardised metadata members asked
 * to be required at group creation surfaces.
 */
export interface StoryStatusProps {
  fields?: StatusField[];
  /** @default "Story-Status" */
  title?: string;
  style?: React.CSSProperties;
}

export function StoryStatus(props: StoryStatusProps): JSX.Element;
