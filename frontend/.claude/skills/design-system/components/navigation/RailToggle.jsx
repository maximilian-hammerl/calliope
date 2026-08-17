import React from "react";

export function RailToggle({ side = "left", label, onClick, style }) {
  const isLeft = side === "left";
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick && onClick();
        }
      }}
      title={`${label} einblenden`}
      style={{
        flex: "none",
        width: "var(--rail-collapsed-w)",
        boxSizing: "border-box",
        background: "var(--surface-edge)",
        [isLeft ? "borderRight" : "borderLeft"]: "1px solid var(--border-subtle)",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: "var(--space-8)",
        gap: "var(--space-7)",
        ...style,
      }}
    >
      <span style={{ fontSize: 13, color: "var(--text-label)" }}>{isLeft ? "›" : "‹"}</span>
      <span
        style={{
          writingMode: "vertical-rl",
          font: "var(--text-label)",
          letterSpacing: ".14em",
          textTransform: "uppercase",
          color: "var(--text-label)",
        }}
      >
        {label}
      </span>
    </div>
  );
}
