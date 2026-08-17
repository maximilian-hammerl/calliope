import React from "react";
import { Button } from "../core/Button.jsx";

const TOOLS = ["B", "I", '„"', "Liste", "Bild", "Datei"];

export function Composer({
  value = "",
  onChange,
  onSubmit,
  onPreview,
  saveState = "saved",
  collapsed = false,
  onToggleCollapse,
  submitting = false,
  label = "Weiterschreiben",
  submitLabel = "Beitrag senden",
  gutter = "var(--thread-gutter)",
  maxWidth = "var(--reading-max)",
  style,
}) {
  const saveText =
    saveState === "saving" ? "Entwurf wird gespeichert" : saveState === "saved" ? "Entwurf gespeichert" : null;

  if (collapsed) {
    return (
      <div
        onClick={onToggleCollapse}
        style={{
          flex: "none",
          borderTop: "1px solid var(--border-subtle)",
          background: "var(--surface-raised)",
          padding: `13px ${gutter}`,
          cursor: "pointer",
          ...style,
        }}
      >
        <div style={{ maxWidth, display: "flex", alignItems: "center", gap: "var(--space-6)", font: "var(--text-control)", color: "var(--text-muted)" }}>
          <span style={{ fontWeight: "var(--weight-semibold)", color: "var(--text-secondary)" }}>{label}</span>
          {saveText && <span>{saveText}</span>}
          <span style={{ marginLeft: "auto", color: "var(--action-quiet-fg)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-control)", padding: "4px 9px" }}>
            Editor ausklappen ⌃
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        flex: "none",
        borderTop: "1px solid var(--border-subtle)",
        background: "var(--surface-raised)",
        padding: `13px ${gutter} var(--space-8)`,
        ...style,
      }}
    >
      <div style={{ maxWidth }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-7)", marginBottom: "var(--space-5)", font: "var(--text-control)", color: "var(--text-muted)" }}>
          <span style={{ fontWeight: "var(--weight-semibold)", color: "var(--text-secondary)" }}>{label}</span>
          {saveState === "saving" && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-3)" }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  border: "1.5px solid var(--border-strong)",
                  borderTopColor: "var(--accent)",
                  display: "inline-block",
                  animation: "calliope-spin var(--spinner-duration) linear infinite",
                }}
              />
              Entwurf wird gespeichert
            </span>
          )}
          {saveState === "saved" && <span>Entwurf gespeichert</span>}
          {onToggleCollapse && (
            <span
              onClick={onToggleCollapse}
              style={{ marginLeft: "auto", cursor: "pointer", color: "var(--action-quiet-fg)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-control)", padding: "4px 9px" }}
            >
              Editor einklappen ⌄
            </span>
          )}
        </div>

        <textarea
          value={value}
          onChange={onChange}
          rows={3}
          style={{
            width: "100%",
            boxSizing: "border-box",
            minHeight: 76,
            border: "none",
            outline: "none",
            resize: "vertical",
            background: "transparent",
            font: "var(--text-composer)",
            color: "var(--text-draft)",
            caretColor: "var(--caret)",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--space-7)",
            borderTop: "1px solid var(--border-hairline)",
            paddingTop: "11px",
            marginTop: "var(--space-3)",
          }}
        >
          <div style={{ display: "flex", gap: "15px", font: "var(--text-control)", color: "var(--text-muted)" }}>
            {TOOLS.map((t, i) => (
              <span key={t} style={{ fontWeight: i === 0 ? 600 : 400, fontStyle: i === 1 ? "italic" : "normal", cursor: "pointer" }}>
                {t}
              </span>
            ))}
          </div>
          <div style={{ display: "flex", gap: "var(--space-5)", alignItems: "center" }}>
            {onPreview && <Button level="outline" onClick={onPreview}>Vorschau</Button>}
            <Button level="solid" size="lg" onClick={onSubmit} disabled={submitting}>
              {submitting ? "Wird gesendet …" : submitLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
