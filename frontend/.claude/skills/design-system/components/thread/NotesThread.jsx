import React from "react";

export function NotesThread({ notes = [], onWrite, writeLabel = "Anmerkung schreiben", style }) {
  return (
    <div
      style={{
        marginTop: "var(--space-7)",
        paddingLeft: "var(--space-8)",
        borderLeft: "2px solid var(--border-strong)",
        display: "flex",
        flexDirection: "column",
        gap: "11px",
        ...style,
      }}
    >
      {notes.map((n, i) => (
        <div key={i} style={{ font: "var(--text-row)", color: "var(--text-draft)", lineHeight: 1.6 }}>
          <span style={{ fontWeight: "var(--weight-semibold)" }}>{n.author}</span>{" "}
          <span style={{ color: "var(--text-meta)", font: "var(--text-hint)" }}>{n.time}</span>
          <br />
          {n.text}
        </div>
      ))}
      {onWrite && (
        <button
          onClick={onWrite}
          style={{
            alignSelf: "flex-start",
            font: "var(--text-control)",
            color: "var(--action-plain-fg)",
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
          }}
        >
          {writeLabel}
        </button>
      )}
    </div>
  );
}
