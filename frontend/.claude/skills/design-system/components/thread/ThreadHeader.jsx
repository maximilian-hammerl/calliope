import React from "react";

export function ThreadHeader({
  title,
  postCount,
  lastActivity,
  lastAuthor,
  filter = "Alle Beiträge",
  onFilter,
  style,
}) {
  const meta = [
    postCount != null ? `${postCount} Beiträge` : null,
    lastActivity ? `zuletzt ${lastActivity}${lastAuthor ? ` von ${lastAuthor}` : ""}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: "var(--space-8)",
        marginBottom: "var(--space-11)",
        ...style,
      }}
    >
      <div>
        <h2 style={{ margin: "0 0 5px", font: "var(--text-h2)", color: "var(--text-title)" }}>{title}</h2>
        {meta && <div style={{ font: "var(--text-control)", color: "var(--text-muted)" }}>{meta}</div>}
      </div>
      {onFilter && (
        <button
          onClick={onFilter}
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
            font: "var(--text-control)",
            color: "var(--action-quiet-fg)",
            background: "var(--paper-1)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-control)",
            padding: "6px 11px",
            cursor: "pointer",
          }}
        >
          {filter} <span style={{ fontSize: 9, color: "var(--text-muted)" }}>▾</span>
        </button>
      )}
    </div>
  );
}
