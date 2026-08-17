import React from "react";

const base = {
  font: "var(--text-control)",
  borderRadius: "var(--radius-control)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: "var(--space-3)",
  textDecoration: "none",
  boxSizing: "border-box",
  transition: "background var(--duration-fast) var(--ease), color var(--duration-fast) var(--ease)",
};

const levels = {
  solid: {
    background: "var(--action-solid-bg)",
    color: "var(--action-solid-fg)",
    border: "1px solid var(--action-solid-bg)",
    hover: { background: "var(--action-solid-bg-hover)", borderColor: "var(--action-solid-bg-hover)" },
  },
  quiet: {
    background: "var(--action-quiet-bg)",
    color: "var(--action-quiet-fg)",
    border: "1px solid var(--action-quiet-border)",
    fontWeight: "var(--weight-medium)",
    hover: { background: "var(--paper-4)" },
  },
  outline: {
    background: "var(--surface-raised)",
    color: "var(--action-quiet-fg)",
    border: "1px solid var(--border-default)",
    hover: { background: "var(--paper-1)" },
  },
  plain: {
    background: "transparent",
    color: "var(--action-plain-fg)",
    border: "1px solid transparent",
    padding: 0,
    hover: { color: "var(--text-secondary)" },
  },
};

const sizes = {
  sm: { padding: "5px 10px" },
  md: { padding: "7px 12px" },
  lg: { padding: "8px 16px" },
};

export function Button({
  children,
  level = "quiet",
  size = "md",
  block = false,
  disabled = false,
  onClick,
  type = "button",
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const l = levels[level] || levels.quiet;
  const { hover: hoverStyle, ...levelStyle } = l;
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...base,
        ...(level === "plain" ? {} : sizes[size]),
        ...levelStyle,
        justifyContent: block ? "center" : undefined,
        width: block ? "100%" : undefined,
        minHeight: level === "plain" ? undefined : "var(--tap-min-desktop, auto)",
        ...(hover && !disabled ? hoverStyle : null),
        ...(disabled
          ? { background: "var(--paper-2)", color: "var(--ink-6)", cursor: "default" }
          : null),
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
