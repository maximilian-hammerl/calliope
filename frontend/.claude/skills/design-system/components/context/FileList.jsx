import React from "react";

export function FileList({ files = [], total, onAll, title = "Dateien & Bilder", style }) {
  return (
    <div style={style}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
        <span style={{ font: "var(--text-control)", fontWeight: "var(--weight-semibold)", color: "var(--text-secondary)" }}>
          {title}
        </span>
        {total != null && onAll && (
          <button
            onClick={onAll}
            style={{ marginLeft: "auto", font: "var(--text-hint)", color: "var(--text-muted)", background: "none", border: "none", padding: 0, cursor: "pointer" }}
          >
            alle {total}
          </button>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", font: "var(--text-control)", color: "var(--text-secondary)" }}>
        {files.map((file) => (
          <div key={file.name} style={{ display: "flex", gap: "var(--space-4)" }}>
            <span style={{ font: "var(--text-filetype)", color: "var(--text-meta)", textTransform: "uppercase" }}>
              {file.type}
            </span>
            {file.name}
          </div>
        ))}
      </div>
    </div>
  );
}
