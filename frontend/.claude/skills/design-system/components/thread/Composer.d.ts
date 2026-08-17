import * as React from "react";

/**
 * The writing surface, fixed to the bottom of the thread column while posts scroll above
 * it, and collapsible to a single line.
 *
 * Non-negotiables, all from research: autosave state is visible and carries NO timestamp
 * ("Entwurf wird gespeichert" with a spinner, then "Entwurf gespeichert"); there is NO
 * word or character counter; `submitting` must disable the submit button so a flaky
 * connection cannot produce a double post — while still allowing a member to post twice
 * in a row deliberately. Prose is set in Newsreader (`--text-composer`), matching what
 * the post will look like.
 *
 * @startingPoint section="Thread" subtitle="Fixed, collapsible composer with autosave" viewport="700x230"
 */
export interface ComposerProps {
  value?: string;
  onChange?: React.ChangeEventHandler<HTMLTextAreaElement>;
  onSubmit?: () => void;
  /** Omit to hide the preview action. */
  onPreview?: () => void;
  /** @default "saved" */
  saveState?: "saving" | "saved" | "none";
  /** @default false */
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  /** Disables submit and shows "Wird gesendet …". @default false */
  submitting?: boolean;
  /** @default "Weiterschreiben" */
  label?: string;
  /** @default "Beitrag senden" */
  submitLabel?: string;
  gutter?: string;
  /** @default "var(--reading-max)" */
  maxWidth?: string;
  style?: React.CSSProperties;
}

export function Composer(props: ComposerProps): JSX.Element;
