import * as React from "react";

/**
 * A bordered, unfilled badge. Two variants only: `label` (uppercase mono, for group
 * visibility) and `tag` (sentence case, for a post state such as "gemerkt").
 *
 * Badges never carry a bare number — always a number plus a noun ("3 neu"), because a
 * bare count was misread in testing.
 */
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children?: React.ReactNode;
  /** @default "label" */
  variant?: "label" | "tag";
}

export function Badge(props: BadgeProps): JSX.Element;
