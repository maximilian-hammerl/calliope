import React from "react";

const sizes = { sm: 22, md: 28, lg: 34 };

export function Avatar({ name = "", size = "md", style, ...rest }) {
  const px = sizes[size] || sizes.md;
  const initial = name.trim().charAt(0).toUpperCase();
  return (
    <span
      aria-hidden={!name || undefined}
      title={name || undefined}
      style={{
        width: px,
        height: px,
        flex: "none",
        borderRadius: "var(--radius-circle)",
        background: "var(--surface-avatar)",
        color: "#5c4a2d",
        font: `var(--weight-semibold) ${Math.round(px * 0.41)}px/${px}px var(--font-ui)`,
        textAlign: "center",
        ...style,
      }}
      {...rest}
    >
      {initial}
    </span>
  );
}
