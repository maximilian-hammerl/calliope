import React from "react";

export function Label({ children, style, ...rest }) {
  return (
    <span
      style={{
        font: "var(--text-label)",
        letterSpacing: "var(--label-tracking)",
        textTransform: "uppercase",
        color: "var(--text-label)",
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}
