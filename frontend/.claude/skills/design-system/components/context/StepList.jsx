import React from "react";
import { PanelCard } from "../core/PanelCard.jsx";
import { Button } from "../core/Button.jsx";
import { Label } from "../core/Label.jsx";

export function StepList({
  steps = [],
  onToggle,
  onAdd,
  doneOpen = false,
  onToggleDone,
  visibleCount = 4,
  title = "Nächste Schritte",
  style,
}) {
  const open = steps.filter((s) => !s.done);
  const done = steps.filter((s) => s.done);
  const rowHeight = 46;
  return (
    <div style={style}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-4)", marginBottom: "var(--space-5)" }}>
        <span style={{ font: "var(--text-control)", fontWeight: "var(--weight-semibold)", color: "var(--text-secondary)" }}>
          {title}
        </span>
        <span style={{ font: "var(--text-hint)", color: "var(--text-muted)" }}>{open.length} offen</span>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-3)",
          maxHeight: visibleCount ? visibleCount * rowHeight : "none",
          overflowY: open.length > visibleCount ? "auto" : "visible",
        }}
      >
        {open.map((s) => (
          <PanelCard
            key={s.id}
            onClick={() => onToggle && onToggle(s.id)}
            style={{ display: "flex", gap: "var(--space-4)", alignItems: "flex-start", cursor: onToggle ? "pointer" : "default" }}
          >
            <span style={{ color: "var(--text-meta)" }}>☐</span>
            <span style={{ flex: 1 }}>
              {s.text}
              {s.author && (
                <>
                  <br />
                  <span style={{ color: "var(--text-meta)", font: "var(--text-hint)" }}>von {s.author}</span>
                </>
              )}
            </span>
          </PanelCard>
        ))}
        {!open.length && (
          <div style={{ font: "var(--text-hint)", color: "var(--text-muted)" }}>Nichts offen.</div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-6)", marginTop: "9px" }}>
        {onAdd && (
          <Button level="quiet" size="sm" onClick={onAdd}>
            ＋ Schritt
          </Button>
        )}
        {done.length > 0 && onToggleDone && (
          <span onClick={onToggleDone} style={{ cursor: "pointer", font: "var(--text-control)", color: "var(--text-muted)" }}>
            Erledigt ({done.length}) {doneOpen ? "▾" : "▸"}
          </span>
        )}
      </div>

      {doneOpen && done.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "5px", marginTop: "var(--space-4)", font: "var(--text-action)", color: "var(--text-meta)" }}>
          {done.map((s) => (
            <div
              key={s.id}
              onClick={() => onToggle && onToggle(s.id)}
              style={{ textDecoration: "line-through", cursor: onToggle ? "pointer" : "default" }}
            >
              {s.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
