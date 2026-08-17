import * as React from "react";

export interface Note {
  author: string;
  /** e.g. "vor 20 Min." */
  time: string;
  text: string;
}

/**
 * Craft feedback on a post, rendered as an indented sub-thread behind a 2px left rule so
 * it can never be mistaken for the story itself. Collapsed by default (`Post.notesCount`
 * is the trigger) — one reviewer worried an always-visible feedback stream would get
 * noisy, so presence is quiet until asked for.
 */
export interface NotesThreadProps {
  notes?: Note[];
  /** Omit to hide the write action. */
  onWrite?: () => void;
  /** @default "Anmerkung schreiben" */
  writeLabel?: string;
  style?: React.CSSProperties;
}

export function NotesThread(props: NotesThreadProps): JSX.Element;
