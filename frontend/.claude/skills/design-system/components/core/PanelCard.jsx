import React from "react";

export function PanelCard({ children, style, ...rest }) {
  return (
    <div
      style={{
        background: "var(--surface-raised)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-control)",
        padding: "9px var(--space-5)",
        font: "var(--text-control)",
        color: "var(--text-secondary)",
        boxShadow: "var(--shadow-none)",
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
