import * as React from "react";

/**
 * Uppercase mono section label — the only uppercase text in the product. Used for rail
 * section headings ("MEINE GRUPPEN", "GRUPPEN-KONTEXT") and nowhere else.
 */
export interface LabelProps extends React.HTMLAttributes<HTMLSpanElement> {
  children?: React.ReactNode;
}

export function Label(props: LabelProps): JSX.Element;
