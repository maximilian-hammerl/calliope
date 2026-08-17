/* The same thread page at 390px. Mobile was a top complaint about the old platform:
   it had no mobile layout at all. Rules: prose stays 17px, targets >= 44px, threads stay
   tabs, the rails become sheets (never drawers over the text), the composer is a fixed
   one-line bar that expands on focus. */
function MobileThread() {
  const { ThreadTabs, Post, NotesThread, Badge, Avatar, StepList, MemberList, FileList, StoryStatus, Label, Button, SearchField } = window.DS;

  const threads = [
    { id: "k1", name: "Kapitel 1" },
    { id: "k2", name: "Kapitel 2" },
    { id: "ip", name: "Ideen & Planung" },
    { id: "ch", name: "Charaktere" },
    { id: "wb", name: "Worldbuilding" },
  ];
  const [thread, setThread] = React.useState("k1");
  const [sheet, setSheet] = React.useState(null); // null | "context" | "groups"
  const [expanded, setExpanded] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [notesOpen, setNotesOpen] = React.useState(false);
  const [tab, setTab] = React.useState("Gruppen");
  const [doneOpen, setDoneOpen] = React.useState(false);
  const [steps, setSteps] = React.useState([
    { id: "s1", text: "Keshs Motiv festlegen", author: "Bob" },
    { id: "s2", text: "Kapitel 2 anlegen", author: "Alice" },
    { id: "s3", text: "Marktszene beginnen", done: true },
  ]);

  const G = "var(--thread-gutter-mobile)";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--surface-app)", fontFamily: "var(--font-ui)", position: "relative", overflow: "hidden" }}>
      {/* Top bar: wordmark + search stay; destinations move to the bottom bar */}
      <div style={{ flex: "none", height: "var(--topbar-h-mobile)", boxSizing: "border-box", display: "flex", alignItems: "center", gap: "var(--space-4)",
                    padding: `0 ${G}`, background: "var(--surface-raised)", borderBottom: "1px solid var(--border-subtle)" }}>
        <span style={{ font: "var(--text-wordmark)", color: "#3a3229" }}>Calliope</span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
          <SearchField width={128} />
          <Avatar name="Alice" size="sm" />
        </div>
      </div>

      {/* Group header: title, visibility, and the trigger for the context sheet */}
      <div style={{ flex: "none", padding: `var(--space-7) ${G} 0` }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-4)", flexWrap: "wrap" }}>
          <h1 style={{ margin: 0, font: "400 21px/1.25 var(--font-prose)", color: "var(--text-title)" }}>Der Erinnerungsmarkt</h1>
          <Badge>Privat</Badge>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", marginTop: "var(--space-4)" }}>
          <Button level="outline" size="sm" style={{ minHeight: "var(--tap-min)" }} onClick={() => setSheet("context")}>
            Gruppen-Kontext
          </Button>
          <span style={{ font: "var(--text-hint)", color: "var(--text-muted)" }}>6 von 12 Threads</span>
        </div>
      </div>

      <ThreadTabs threads={threads} activeId={thread} onSelect={setThread} onCreate={() => {}} gutter={G} />

      <div style={{ flex: 1, overflow: "auto", padding: `var(--space-9) ${G} var(--space-9)` }}>
        <h2 style={{ margin: "0 0 5px", font: "400 18px/1.3 var(--font-prose)", color: "var(--text-title)" }}>
          Kapitel 1 — Der Markt öffnet
        </h2>
        <div style={{ font: "var(--text-control)", color: "var(--text-muted)", marginBottom: "var(--space-9)" }}>
          14 Beiträge · zuletzt vor 12 Minuten von Bob
        </div>

        <Post author="Alice" time="Dienstag, 09:14" notesCount={2} notesOpen={notesOpen}
              onToggleNotes={() => setNotesOpen((v) => !v)} style={{ paddingTop: 0 }}>
          <p>Der Markt öffnete immer erst, wenn das letzte Licht aus den Fenstern der Weberstraße gewichen war. Mira wusste das, seit sie sieben war.</p>
          <p>Sie zog den Kragen höher und trat zwischen die Stände. Öl, Papier, kalter Stein.</p>
          {notesOpen && (
            <NotesThread onWrite={() => {}} notes={[
              { author: "Bob", time: "vor 20 Min.", text: "Der zweite Absatz ist stark." },
              { author: "Carol", time: "vor 8 Min.", text: "Als Leserin: der Einstieg hat mich sofort drin gehabt." }]} />
          )}
        </Post>
        <Post author="Bob" time="vor 12 Minuten" edited bookmarked divider={false}>
          <p>Kesh sah das Mädchen, bevor es ihn sah — daran erkannte er die Gewohnten.</p>
        </Post>
      </div>

      {/* Composer: fixed one-line bar, expands on focus */}
      <div style={{ flex: "none", borderTop: "1px solid var(--border-subtle)", background: "var(--surface-raised)", padding: `var(--space-5) ${G}` }}>
        {expanded ? (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", marginBottom: "var(--space-4)", font: "var(--text-control)", color: "var(--text-muted)" }}>
              <span style={{ fontWeight: "var(--weight-semibold)", color: "var(--text-secondary)" }}>Weiterschreiben</span>
              {draft ? <span>Entwurf gespeichert</span> : null}
              <span onClick={() => setExpanded(false)} style={{ marginLeft: "auto", cursor: "pointer", color: "var(--action-quiet-fg)",
                     border: "1px solid var(--border-default)", borderRadius: "var(--radius-control)", padding: "6px 10px" }}>Schließen ⌄</span>
            </div>
            <textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} rows={4}
              placeholder="Mira antwortete nicht sofort …"
              style={{ width: "100%", boxSizing: "border-box", border: "none", outline: "none", resize: "none", background: "transparent",
                       font: "var(--text-composer)", color: "var(--text-draft)", caretColor: "var(--caret)" }} />
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-5)", borderTop: "1px solid var(--border-hairline)", paddingTop: "var(--space-5)" }}>
              <div style={{ display: "flex", gap: "var(--space-7)", font: "var(--text-control)", color: "var(--text-muted)" }}>
                <span style={{ fontWeight: 600 }}>B</span><span style={{ fontStyle: "italic" }}>I</span><span>„"</span><span>Bild</span>
              </div>
              <div style={{ marginLeft: "auto" }}>
                <Button level="solid" size="lg" style={{ minHeight: "var(--tap-min)" }}>Senden</Button>
              </div>
            </div>
          </div>
        ) : (
          <div onClick={() => setExpanded(true)}
               style={{ display: "flex", alignItems: "center", gap: "var(--space-5)", minHeight: "var(--tap-min)", cursor: "pointer" }}>
            <span style={{ flex: 1, font: "400 15px/1.4 var(--font-prose)", color: "var(--text-muted)" }}>Weiterschreiben …</span>
            <Button level="outline" size="sm" style={{ minHeight: 38 }}>Editor</Button>
          </div>
        )}
      </div>

      {/* Bottom bar: the product's destinations */}
      <div style={{ flex: "none", height: "var(--bottombar-h-mobile)", boxSizing: "border-box", display: "flex", alignItems: "stretch",
                    borderTop: "1px solid var(--border-subtle)", background: "var(--surface-raised)" }}>
        {["Gruppen", "Forum", "Partner", "Post"].map((t) => {
          const on = t === tab;
          return (
            <button key={t} onClick={() => { setTab(t); if (t === "Gruppen") setSheet("groups"); }}
              style={{ flex: 1, minHeight: "var(--tap-min)", background: "none", border: "none", cursor: "pointer",
                       font: "var(--text-control)", color: on ? "var(--text-title)" : "var(--text-muted)",
                       fontWeight: on ? "var(--weight-semibold)" : "var(--weight-regular)",
                       boxShadow: on ? "inset 0 2px 0 var(--tab-active-underline)" : "none" }}>{t}</button>
          );
        })}
      </div>

      {/* Sheets replace the rails */}
      {sheet && (
        <div onClick={() => setSheet(null)} style={{ position: "absolute", inset: 0, background: "rgba(43,38,32,.20)", display: "flex", alignItems: "flex-end" }}>
          <div onClick={(e) => e.stopPropagation()}
               style={{ width: "100%", maxHeight: "78%", overflowY: "auto", background: "var(--surface-rail)",
                        borderTop: "1px solid var(--border-strong)", boxShadow: "var(--shadow-sheet)",
                        padding: `var(--space-7) ${G} var(--space-9)`, display: "flex", flexDirection: "column", gap: "var(--space-9)" }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <Label>{sheet === "context" ? "Gruppen-Kontext" : "Meine Gruppen"}</Label>
              <span onClick={() => setSheet(null)} style={{ marginLeft: "auto", cursor: "pointer", minHeight: 34, font: "var(--text-control)",
                     color: "var(--action-quiet-fg)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-control)", padding: "7px 12px" }}>Schließen</span>
            </div>
            {sheet === "context" ? (
              <React.Fragment>
                <StepList steps={steps} doneOpen={doneOpen} onToggleDone={() => setDoneOpen((v) => !v)} onAdd={() => {}}
                          onToggle={(id) => setSteps((s) => s.map((x) => (x.id === id ? { ...x, done: !x.done } : x)))} />
                <StoryStatus fields={[
                  { label: "Status", value: "Wird geschrieben", strong: true },
                  { label: "Genre", value: "Fantasy, Mystery" },
                  { label: "Perspektive", value: "3. Person, Vergangenheit" }]} />
                <FileList total={12} onAll={() => {}} files={[
                  { name: "stadtkarte.png", type: "png" }, { name: "zeitleiste.md", type: "md" }]} />
                <MemberList sticky={false} members={[{ name: "Alice", role: "Admin" }, { name: "Bob", role: "Autor" }, { name: "Carol", role: "Leserin" }]} onInvite={() => {}} />
              </React.Fragment>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", font: "var(--text-row)" }}>
                {[["Der Erinnerungsmarkt", true], ["Königreich aus Asche", false], ["Mondlicht & Rosen", false]].map(([n, on]) => (
                  <div key={n} style={{ minHeight: "var(--tap-min)", display: "flex", alignItems: "center", padding: "0 var(--space-5)",
                                        background: on ? "var(--surface-raised)" : "transparent",
                                        border: `1px solid ${on ? "var(--border-strong)" : "transparent"}`,
                                        borderRadius: "var(--radius-control)",
                                        fontWeight: on ? "var(--weight-semibold)" : "var(--weight-regular)",
                                        color: on ? "var(--text-title)" : "var(--text-secondary)" }}>{n}</div>
                ))}
                <div style={{ marginTop: "var(--space-4)" }}><Button level="quiet" block style={{ minHeight: "var(--tap-min)" }}>＋ Gruppe gründen</Button></div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
window.Kit = Object.assign(window.Kit || {}, { MobileThread });
