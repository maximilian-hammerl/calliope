import * as React from "react";

/**
 * The only card in Calliope: a raised row inside a recessed rail — used for step items,
 * group rows and small panel groupings. Never used in the reading column, and never
 * carries a shadow.
 */
export interface PanelCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export function PanelCard(props: PanelCardProps): JSX.Element;
