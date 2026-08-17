import React from "react";
import { Button } from "../core/Button.jsx";

export function MemberList({
  members = [],
  onInvite,
  inviteLabel = "Mitglied einladen",
  title = "Mitglieder",
  sticky = true,
  style,
}) {
  return (
    <div
      style={{
        marginTop: sticky ? "auto" : undefined,
        position: sticky ? "sticky" : "static",
        bottom: sticky ? -16 : undefined,
        background: "var(--surface-rail)",
        borderTop: sticky ? "1px solid var(--border-subtle)" : "none",
        paddingTop: "var(--space-7)",
        ...style,
      }}
    >
      <div style={{ font: "var(--text-control)", fontWeight: "var(--weight-semibold)", color: "var(--text-secondary)", marginBottom: "var(--space-5)" }}>
        {title}
      </div>
      <div style={{ font: "var(--text-control)", lineHeight: "var(--leading-panel)", color: "var(--text-secondary)" }}>
        {members.map((m) => (
          <div key={m.name}>
            {m.name} <span style={{ color: "var(--text-meta)" }}>· {m.role}</span>
          </div>
        ))}
      </div>
      {onInvite && (
        <div style={{ margin: "var(--space-5) 0 2px" }}>
          <Button level="quiet" block onClick={onInvite}>
            {inviteLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
