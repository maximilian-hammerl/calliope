import React from "react";

export function GroupList({
  groups = [],
  activeId,
  onSelect,
  onCreate,
  createLabel = "＋ Gruppe gründen",
  style,
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", ...style }}>
      {groups.map((g) => {
        const on = g.id === activeId;
        return (
          <a
            key={g.id}
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onSelect && onSelect(g.id);
            }}
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "var(--space-4)",
              padding: "9px var(--space-5)",
              font: "var(--text-row)",
              textDecoration: "none",
              boxSizing: "border-box",
              minHeight: 34,
              color: on ? "var(--text-title)" : "var(--text-secondary)",
              fontWeight: on ? "var(--weight-semibold)" : "var(--weight-regular)",
              background: on ? "var(--surface-raised)" : "transparent",
              border: `1px solid ${on ? "var(--border-strong)" : "transparent"}`,
              borderRadius: "var(--radius-control)",
            }}
          >
            <span>{g.name}</span>
            {g.unread ? (
              <span
                style={{
                  marginLeft: "auto",
                  font: "var(--text-hint)",
                  color: "var(--text-muted)",
                  whiteSpace: "nowrap",
                }}
              >
                {g.unread} neu
              </span>
            ) : null}
          </a>
        );
      })}
      {onCreate && (
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            onCreate();
          }}
          style={{
            marginTop: "var(--space-4)",
            padding: "9px var(--space-5)",
            textAlign: "center",
            font: "var(--text-control)",
            fontWeight: "var(--weight-medium)",
            color: "var(--action-quiet-fg)",
            background: "var(--action-quiet-bg)",
            border: "1px solid var(--action-quiet-border)",
            borderRadius: "var(--radius-control)",
            textDecoration: "none",
          }}
        >
          {createLabel}
        </a>
      )}
    </div>
  );
}
