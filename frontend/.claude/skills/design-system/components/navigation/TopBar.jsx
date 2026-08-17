import React from "react";
import { SearchField } from "../core/SearchField.jsx";
import { Avatar } from "../core/Avatar.jsx";

export function TopBar({
  items = ["Startseite", "Forum", "Schreibpartner", "Meine Gruppen", "Nachrichten"],
  active = "Meine Gruppen",
  onSelect,
  user = "Alice",
  query,
  onQueryChange,
  compact = false,
  style,
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: compact ? "var(--space-4)" : "var(--space-11)",
        padding: `0 ${compact ? "var(--space-7)" : "var(--space-10)"}`,
        height: compact ? "var(--topbar-h-mobile)" : "var(--topbar-h)",
        boxSizing: "border-box",
        background: "var(--surface-raised)",
        borderBottom: "1px solid var(--border-subtle)",
        ...style,
      }}
    >
      <span style={{ font: "var(--text-wordmark)", color: "#3a3229", letterSpacing: ".01em" }}>
        Calliope
      </span>
      {!compact && (
        <nav style={{ display: "flex", gap: "var(--space-9)", font: "var(--text-nav)" }}>
          {items.map((it) => {
            const on = it === active;
            return (
              <a
                key={it}
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  onSelect && onSelect(it);
                }}
                style={{
                  textDecoration: "none",
                  color: on ? "var(--text-title)" : "var(--text-muted)",
                  fontWeight: on ? "var(--weight-semibold)" : "var(--weight-regular)",
                  boxShadow: on ? "inset 0 -2px 0 var(--tab-active-underline)" : "none",
                  paddingBottom: on ? 17 : 0,
                }}
              >
                {it}
              </a>
            );
          })}
        </nav>
      )}
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "var(--space-7)" }}>
        <SearchField value={query} onChange={onQueryChange} width={compact ? 120 : 210} />
        <Avatar name={user} />
      </div>
    </div>
  );
}
