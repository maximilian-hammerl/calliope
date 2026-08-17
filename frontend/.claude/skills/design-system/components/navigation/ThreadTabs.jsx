import React from "react";

export function ThreadTabs({
  threads = [],
  activeId,
  onSelect,
  onCreate,
  createLabel = "＋ Thread",
  sticky = true,
  gutter = "var(--thread-gutter)",
  style,
}) {
  return (
    <div
      style={{
        padding: `15px ${gutter} 0`,
        position: sticky ? "sticky" : "static",
        top: 0,
        zIndex: 2,
        background: "var(--surface-app)",
        boxShadow: "0 1px 0 var(--border-subtle)",
        ...style,
      }}
    >
      <div
        className="calliope-scroll-x"
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "var(--space-9)",
          whiteSpace: "nowrap",
          font: "var(--text-tab)",
        }}
      >
        {threads.map((t) => {
          const on = t.id === activeId;
          return (
            <a
              key={t.id}
              href="#"
              onClick={(e) => {
                e.preventDefault();
                onSelect && onSelect(t.id);
              }}
              style={{
                flex: "none",
                textDecoration: "none",
                padding: "0 0 11px",
                color: on ? "var(--text-title)" : "var(--text-muted)",
                fontWeight: on ? "var(--weight-medium)" : "var(--weight-regular)",
                borderBottom: `2px solid ${on ? "var(--tab-active-underline)" : "transparent"}`,
              }}
            >
              {t.name}
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
              flex: "none",
              textDecoration: "none",
              padding: "0 0 11px",
              color: "var(--ink-5)",
              borderBottom: "2px solid transparent",
            }}
          >
            {createLabel}
          </a>
        )}
      </div>
    </div>
  );
}
