import * as React from "react";

/**
 * The 34px edge strip a collapsed rail leaves behind: chevron plus vertical mono label,
 * clickable anywhere to reopen. Left and right rails use the identical treatment — the
 * asymmetric version (a button in the header) was rejected in testing.
 *
 * Collapsing both rails plus the composer IS the product's reading mode; there is no
 * separate mode.
 */
export interface RailToggleProps {
  /** @default "left" */
  side?: "left" | "right";
  /** Vertical label, e.g. "Gruppen" or "Gruppen-Kontext". */
  label?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export function RailToggle(props: RailToggleProps): JSX.Element;
