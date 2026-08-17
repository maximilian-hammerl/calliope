import * as React from "react";

export interface Member {
  name: string;
  /** Gendered per person, matching the backend roles: "Admin", "Autor", "Autorin", "Leser", "Leserin". */
  role: string;
}

/**
 * Who is in this group, pinned to the BOTTOM of the right rail (`sticky`) so it stays
 * reachable however long the panel above it grows. Members belong to the group-context
 * rail, not the left rail — moving them here was direct test feedback.
 *
 * Roles appear here and only here; a role badge next to a post author was removed.
 */
export interface MemberListProps {
  members?: Member[];
  /** Omit to hide the invite action. */
  onInvite?: () => void;
  /** @default "Mitglied einladen" */
  inviteLabel?: string;
  /** @default "Mitglieder" */
  title?: string;
  /** Pin to the bottom of the rail. @default true */
  sticky?: boolean;
  style?: React.CSSProperties;
}

export function MemberList(props: MemberListProps): JSX.Element;
