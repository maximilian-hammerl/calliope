import * as React from "react";

/**
 * Initial on warm paper. Calliope has no uploaded or generated avatar images — a member
 * is represented by the first letter of their display name.
 */
export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Display name; the first letter is rendered. */
  name?: string;
  /** @default "md" */
  size?: "sm" | "md" | "lg";
}

export function Avatar(props: AvatarProps): JSX.Element;
