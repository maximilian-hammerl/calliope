import * as React from "react";

export interface GroupListItem {
  id: string;
  name: string;
  /** Unread post count. Rendered as "{n} neu" — never as a bare number. */
  unread?: number;
}

/**
 * The left rail's only content: the member's writing groups. Threads must NOT appear
 * here — they are the tab strip, and duplicating them was explicitly rejected in testing.
 *
 * @startingPoint section="Navigation" subtitle="Left-rail group list with create action" viewport="700x220"
 */
export interface GroupListProps {
  groups?: GroupListItem[];
  activeId?: string;
  onSelect?: (id: string) => void;
  /** Omit to hide the create action. */
  onCreate?: () => void;
  /** @default "＋ Gruppe gründen" */
  createLabel?: string;
  style?: React.CSSProperties;
}

export function GroupList(props: GroupListProps): JSX.Element;
