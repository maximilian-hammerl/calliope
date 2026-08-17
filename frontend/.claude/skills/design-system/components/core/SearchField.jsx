import React from "react";

export function SearchField({
  value,
  onChange,
  placeholder = "Suche",
  width = 210,
  style,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        width,
        height: 30,
        boxSizing: "border-box",
        padding: "0 var(--space-5)",
        background: "var(--paper-1)",
        border: `1px solid ${focus ? "var(--focus-ring)" : "var(--border-default)"}`,
        borderRadius: "var(--radius-control)",
        font: "var(--text-control)",
        color: "var(--text-muted)",
        ...style,
      }}
    >
      <span aria-hidden="true">⌕</span>
      <input
        type="search"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{
          flex: 1,
          minWidth: 0,
          border: "none",
          outline: "none",
          background: "transparent",
          font: "var(--text-control)",
          color: "var(--text-title)",
        }}
        {...rest}
      />
    </label>
  );
}
