import React from "react";

export function Badge({ children, variant = "label", style, ...rest }) {
  const variants = {
    // Uppercase mono badge: group visibility ("Privat")
    label: {
      font: "var(--text-label)",
      letterSpacing: "var(--label-tracking)",
      textTransform: "uppercase",
      color: "var(--text-muted)",
      border: "1px solid var(--border-default)",
      padding: "4px 7px",
    },
    // Sentence-case state tag on a post ("gemerkt")
    tag: {
      font: "var(--text-hint)",
      color: "var(--text-muted)",
      border: "1px solid var(--border-strong)",
      padding: "2px 6px",
    },
  };
  return (
    <span
      style={{
        display: "inline-block",
        borderRadius: "var(--radius-tag)",
        whiteSpace: "nowrap",
        ...variants[variant],
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}
