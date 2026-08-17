import React from "react";
import { Badge } from "../core/Badge.jsx";

export function GroupHeader({
  name,
  visibility = "Privat",
  threadCount,
  threadLimit,
  gutter = "var(--thread-gutter)",
  children,
  style,
}) {
  return (
    <div style={{ padding: `var(--space-9) ${gutter} 0`, ...style }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-6)", flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, font: "var(--text-h1)", color: "var(--text-title)" }}>{name}</h1>
        {visibility && <Badge>{visibility}</Badge>}
        {threadCount != null && (
          <span style={{ font: "var(--text-hint)", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
            {threadLimit != null ? `${threadCount} von ${threadLimit} Threads` : `${threadCount} Threads`}
          </span>
        )}
        {children}
      </div>
    </div>
  );
}
