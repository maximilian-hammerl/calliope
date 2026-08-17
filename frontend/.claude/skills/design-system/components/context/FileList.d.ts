import * as React from "react";

export interface GroupFile {
  name: string;
  /** Short type tag rendered as mono text: "png", "md", "jpg". Never a file icon. */
  type: string;
}

/**
 * The group's shared files and images, as a text list. A thumbnail-grid variant was built
 * and rejected — the list was judged more useful. Files belong to the group, so this panel
 * is identical across all of its threads.
 */
export interface FileListProps {
  files?: GroupFile[];
  /** Total count behind the "alle {n}" link. */
  total?: number;
  onAll?: () => void;
  /** @default "Dateien & Bilder" */
  title?: string;
  style?: React.CSSProperties;
}

export function FileList(props: FileListProps): JSX.Element;
