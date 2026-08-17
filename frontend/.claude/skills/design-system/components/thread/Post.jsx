import React from "react";
import { Badge } from "../core/Badge.jsx";

export function Post({
  author,
  time,
  edited = false,
  bookmarked = false,
  children,
  actions = ["Antworten", "Zitieren", "Merken"],
  onAction,
  notesCount,
  notesOpen = false,
  onToggleNotes,
  divider = true,
  style,
}) {
  const meta = [author, time, edited ? "bearbeitet" : null].filter(Boolean).join(" · ");
  return (
    <article
      style={{
        padding: `var(--post-gap) 0`,
        borderBottom: divider ? "1px solid var(--border-divider)" : "none",
        ...style,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-6)", marginBottom: "9px" }}>
        <span style={{ font: "var(--text-meta)", color: "var(--text-meta)" }}>{meta}</span>
        {bookmarked && <Badge variant="tag">gemerkt</Badge>}
      </div>

      <div className="calliope-prose">{children}</div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-8)",
          marginTop: "var(--space-7)",
          font: "var(--text-action)",
          color: "var(--action-plain-fg)",
        }}
      >
        {notesCount ? (
          <button
            onClick={onToggleNotes}
            style={{
              font: "var(--text-action)",
              color: "var(--action-quiet-fg)",
              background: "none",
              border: "none",
              borderBottom: "1px solid var(--border-default)",
              padding: 0,
              cursor: "pointer",
            }}
          >
            {notesCount} Anmerkungen{notesOpen ? "" : " anzeigen"}
          </button>
        ) : null}
        {actions.map((a) => (
          <button
            key={a}
            onClick={() => onAction && onAction(a)}
            style={{
              font: "var(--text-action)",
              color: "var(--action-plain-fg)",
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
            }}
          >
            {a}
          </button>
        ))}
      </div>
    </article>
  );
}
