import * as React from "react";

/**
 * Three action levels and nothing more. `solid` is the one primary act on a screen
 * ("Beitrag senden"); `quiet` is an affirmative side action ("Mitglied einladen",
 * "＋ Schritt"); `outline` is a neutral companion to a solid button ("Vorschau");
 * `plain` is a text-only per-post action ("Antworten").
 *
 * @startingPoint section="Core" subtitle="Solid, quiet, outline and plain actions" viewport="700x150"
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
  /** @default "quiet" */
  level?: "solid" | "quiet" | "outline" | "plain";
  /** @default "md" */
  size?: "sm" | "md" | "lg";
  /** Fill the container width and centre the label. @default false */
  block?: boolean;
  /** @default false */
  disabled?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}

export function Button(props: ButtonProps): JSX.Element;
