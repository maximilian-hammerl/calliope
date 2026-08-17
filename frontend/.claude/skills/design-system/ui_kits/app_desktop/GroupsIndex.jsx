/* EXTRAPOLATION — no mockup exists for this screen. It reuses only tested patterns:
   left rail group list, Newsreader 400 headings, hairline rows, quiet actions. */
function GroupsIndex({ onOpenGroup, onCreateGroup }) {
  const { TopBar, GroupList, Label, Badge, Button } = window.DS;
  const groups = [
    { id: "em", name: "Der Erinnerungsmarkt", visibility: "Privat", members: "Alice, Bob, Carol",
      status: "Wird geschrieben", last: "vor 12 Minuten von Bob", threads: 6 },
    { id: "ka", name: "Königreich aus Asche", visibility: "Privat", members: "Alice, Dora",
      status: "Wird geschrieben", last: "gestern von Dora", threads: 9 },
    { id: "mr", name: "Mondlicht & Rosen", visibility: "Öffentlich", members: "Alice, Bob, Erik, Fee",
      status: "Pause", last: "12. Februar von Erik", threads: 3 },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--surface-app)", fontFamily: "var(--font-ui)" }}>
      <TopBar active="Meine Gruppen" />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <aside style={{ flex: "none", width: "var(--rail-left-w)", boxSizing: "border-box", background: "var(--surface-rail)",
                        borderRight: "1px solid var(--border-subtle)", padding: "16px 11px" }}>
          <div style={{ padding: "0 5px 9px" }}><Label>Meine Gruppen</Label></div>
          <GroupList groups={groups} activeId="" onSelect={onOpenGroup} onCreate={onCreateGroup} />
        </aside>
        <main style={{ flex: 1, minWidth: 0, overflow: "auto", padding: "var(--space-9) var(--thread-gutter) var(--space-12)" }}>
          <div style={{ maxWidth: 760 }}>
            <h1 style={{ margin: "0 0 var(--space-9)", font: "var(--text-h1)", color: "var(--text-title)" }}>Meine Gruppen</h1>
            {groups.map((g, i) => (
              <div key={g.id} style={{ padding: "var(--post-gap) 0", borderTop: i ? "1px solid var(--border-divider)" : "none" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-6)" }}>
                  <a href="#" onClick={(e) => { e.preventDefault(); onOpenGroup && onOpenGroup(g.id); }}
                     style={{ font: "var(--text-h2)", color: "var(--text-title)", textDecoration: "none" }}>{g.name}</a>
                  <Badge>{g.visibility}</Badge>
                  <span style={{ font: "var(--text-hint)", color: "var(--text-muted)" }}>{g.threads} Threads</span>
                </div>
                <div style={{ font: "var(--text-control)", color: "var(--text-muted)", marginTop: "var(--space-3)", lineHeight: "var(--leading-panel)" }}>
                  {g.members}<br />
                  Status: {g.status} · zuletzt {g.last}
                </div>
                <div style={{ marginTop: "var(--space-5)" }}>
                  <Button level="outline" size="sm" onClick={() => onOpenGroup && onOpenGroup(g.id)}>Gruppe öffnen</Button>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
window.Kit = Object.assign(window.Kit || {}, { GroupsIndex });
