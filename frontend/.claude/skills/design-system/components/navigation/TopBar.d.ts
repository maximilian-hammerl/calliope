import * as React from "react";

/**
 * The product's one global navigation bar: wordmark, five destinations, search, account.
 * Fixed 54px on desktop (`compact` renders the 52px mobile bar, where the destinations
 * move to a bottom bar instead).
 *
 * The active destination is marked by a 2px `--accent` underline — never a filled pill.
 *
 * @startingPoint section="Navigation" subtitle="Global top bar with search and account" viewport="700x120"
 */
export interface TopBarProps {
  /** @default ["Startseite","Forum","Schreibpartner","Meine Gruppen","Nachrichten"] */
  items?: string[];
  /** @default "Meine Gruppen" */
  active?: string;
  onSelect?: (item: string) => void;
  /** Display name for the account avatar. @default "Alice" */
  user?: string;
  query?: string;
  onQueryChange?: React.ChangeEventHandler<HTMLInputElement>;
  /** Mobile bar: hides the nav row, shortens search. @default false */
  compact?: boolean;
  style?: React.CSSProperties;
}

export function TopBar(props: TopBarProps): JSX.Element;
