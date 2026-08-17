import React from "react";

export function StoryStatus({ fields = [], title = "Story-Status", style }) {
  return (
    <div style={style}>
      <div style={{ font: "var(--text-control)", fontWeight: "var(--weight-semibold)", color: "var(--text-secondary)", marginBottom: "var(--space-4)" }}>
        {title}
      </div>
      <div style={{ font: "var(--text-control)", color: "var(--text-secondary)", lineHeight: "var(--leading-panel)" }}>
        {fields.map((f) => (
          <div key={f.label}>
            {f.label}: {f.strong ? <strong style={{ fontWeight: "var(--weight-semibold)" }}>{f.value}</strong> : f.value}
          </div>
        ))}
      </div>
    </div>
  );
}
