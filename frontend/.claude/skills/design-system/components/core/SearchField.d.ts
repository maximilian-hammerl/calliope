import * as React from "react";

/**
 * The top-bar search input. Placeholder is the single word "Suche" — a longer scope
 * hint ("Suchen in allen Gruppen …") was tested and cut as noise.
 *
 * INTENTIONAL ADDITION: the mockups only show this control at rest, so its focus and
 * typing behaviour here is an extrapolation.
 */
export interface SearchFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "width"> {
  value?: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  /** @default "Suche" */
  placeholder?: string;
  /** @default 210 */
  width?: number | string;
}

export function SearchField(props: SearchFieldProps): JSX.Element;
