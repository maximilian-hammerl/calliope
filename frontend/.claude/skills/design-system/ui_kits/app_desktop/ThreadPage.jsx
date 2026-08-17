/* The accepted design (mockup 3a): a private writing group's thread page. */
function ThreadPage({ group, onOpenGroups, onCreateGroup }) {
  const {
    TopBar, GroupList, ThreadTabs, RailToggle,
    GroupHeader, ThreadHeader, Post, NotesThread, Composer,
    StepList, MemberList, FileList, StoryStatus, Label,
  } = window.DS;

  const threads = [
    { id: "k1", name: "Kapitel 1" },
    { id: "k2", name: "Kapitel 2" },
    { id: "ip", name: "Ideen & Planung" },
    { id: "ch", name: "Charaktere" },
    { id: "wb", name: "Worldbuilding" },
    { id: "ag", name: "Allgemein" },
  ];

  const seed = [
    {
      id: "p1", author: "Alice", time: "Dienstag, 09:14",
      paras: [
        "Der Markt öffnete immer erst, wenn das letzte Licht aus den Fenstern der Weberstraße gewichen war. Mira wusste das, seit sie sieben war und ihre Mutter zum ersten Mal etwas verkauft hatte, das sie danach nicht mehr benennen konnte.",
        "Sie zog den Kragen höher und trat zwischen die Stände. Öl, Papier, kalter Stein. Und darunter, wie immer, dieser süßliche Geruch fremder Sommer.",
      ],
      notes: [
        { author: "Bob", time: "vor 20 Min.", text: "Der zweite Absatz ist stark. „fremder Sommer“ würde ich vorne schon andeuten." },
        { author: "Carol", time: "vor 8 Min.", text: "Als Leserin: der Einstieg hat mich sofort drin gehabt." },
      ],
    },
    {
      id: "p2", author: "Bob", time: "vor 12 Minuten", edited: true, bookmarked: true,
      paras: [
        "Kesh sah das Mädchen, bevor es ihn sah — daran erkannte er die Gewohnten. Wer zum ersten Mal kam, blieb am Eingang stehen und suchte ein Schild.",
        "„Du willst etwas verkaufen“, sagte er, ohne aufzublicken. „Alle, die so gehen, wollen verkaufen.“",
      ],
    },
    {
      id: "p3", author: "Alice", time: "vor 4 Minuten",
      paras: ["Sie hätte lügen können. Stattdessen sagte sie die Wahrheit, und das war der Fehler, den sie später nicht mehr rückgängig machen konnte."],
    },
  ];

  const [thread, setThread] = React.useState("k1");
  const [leftOpen, setLeftOpen] = React.useState(true);
  const [rightOpen, setRightOpen] = React.useState(true);
  const [editorOpen, setEditorOpen] = React.useState(true);
  const [openNotes, setOpenNotes] = React.useState({ p1: true });
  const [posts, setPosts] = React.useState(seed);
  const [draft, setDraft] = React.useState("Mira antwortete nicht sofort. Sie zählte die Laternen, wie ihre Mutter es ihr beigebracht hatte —");
  const [saveState, setSaveState] = React.useState("saved");
  const [sending, setSending] = React.useState(false);
  const [doneOpen, setDoneOpen] = React.useState(false);
  const [steps, setSteps] = React.useState([
    { id: "s1", text: "Keshs Motiv festlegen", author: "Bob" },
    { id: "s2", text: "Kapitel 2 anlegen", author: "Alice" },
    { id: "s3", text: "Zeitleiste nachziehen", author: "Alice" },
    { id: "s4", text: "Marktnamen sammeln", author: "Carol" },
    { id: "s5", text: "Marktszene beginnen", done: true },
    { id: "s6", text: "Mira benennen", done: true },
    { id: "s7", text: "Perspektive festlegen", done: true },
  ]);

  // Autosave: visible, continuous, never timestamped.
  React.useEffect(() => {
    if (!draft) return;
    setSaveState("saving");
    const t = setTimeout(() => setSaveState("saved"), 900);
    return () => clearTimeout(t);
  }, [draft]);

  // Submitting locks the button: a flaky connection must not produce a double post.
  function send() {
    if (!draft.trim() || sending) return;
    setSending(true);
    setTimeout(() => {
      setPosts((p) => [...p, { id: "n" + p.length, author: "Alice", time: "gerade eben", paras: [draft.trim()] }]);
      setDraft("");
      setSending(false);
      setSaveState("none");
    }, 700);
  }

  const activeThread = threads.find((t) => t.id === thread);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--surface-app)", fontFamily: "var(--font-ui)" }}>
      <TopBar active="Meine Gruppen" onSelect={(i) => i === "Meine Gruppen" && onOpenGroups && onOpenGroups()} />

      <div style={{ display: "flex", alignItems: "stretch", flex: 1, minHeight: 0 }}>
        {leftOpen ? (
          <aside style={{ flex: "none", width: "var(--rail-left-w)", boxSizing: "border-box", background: "var(--surface-rail)",
                          borderRight: "1px solid var(--border-subtle)", padding: "16px 11px", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <div style={{ display: "flex", alignItems: "center", padding: "0 5px 9px" }}>
              <Label>Meine Gruppen</Label>
              <span onClick={() => setLeftOpen(false)}
                    style={{ marginLeft: "auto", cursor: "pointer", fontSize: 13, color: "var(--text-label)",
                             padding: "2px 6px", border: "1px solid var(--border-default)", borderRadius: "var(--radius-xs)", lineHeight: 1.1 }}>‹</span>
            </div>
            <GroupList
              groups={[{ id: "em", name: "Der Erinnerungsmarkt" }, { id: "ka", name: "Königreich aus Asche" }, { id: "mr", name: "Mondlicht & Rosen" }]}
              activeId="em" onCreate={onCreateGroup} />
          </aside>
        ) : (
          <RailToggle side="left" label="Gruppen" onClick={() => setLeftOpen(true)} />
        )}

        <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <GroupHeader name={group || "Der Erinnerungsmarkt"} visibility="Privat" threadCount={6} threadLimit={12} />
          <ThreadTabs threads={threads} activeId={thread} onSelect={setThread} onCreate={() => {}} />

          <div style={{ flex: 1, overflow: "auto", padding: "var(--space-11) var(--thread-gutter) var(--space-12)" }}>
            <div style={{ maxWidth: "var(--reading-max)" }}>
              <ThreadHeader
                title={thread === "k1" ? "Kapitel 1 — Der Markt öffnet" : activeThread.name}
                postCount={thread === "k1" ? posts.length + 11 : 0}
                lastActivity={thread === "k1" ? "vor 12 Minuten" : undefined}
                lastAuthor={thread === "k1" ? "Bob" : undefined}
                onFilter={() => {}} />

              {thread === "k1" ? (
                posts.map((p, i) => (
                  <Post key={p.id} author={p.author} time={p.time} edited={p.edited} bookmarked={p.bookmarked}
                        notesCount={p.notes ? p.notes.length : undefined}
                        notesOpen={!!openNotes[p.id]}
                        onToggleNotes={() => setOpenNotes((o) => ({ ...o, [p.id]: !o[p.id] }))}
                        divider={i < posts.length - 1}
                        style={i === 0 ? { paddingTop: 0 } : undefined}>
                    {p.paras.map((t, j) => <p key={j}>{t}</p>)}
                    {p.notes && openNotes[p.id] && <NotesThread notes={p.notes} onWrite={() => {}} />}
                  </Post>
                ))
              ) : (
                <div style={{ font: "var(--text-control)", color: "var(--text-muted)", lineHeight: 1.7 }}>
                  Noch keine Beiträge in „{activeThread.name}“. Schreib den ersten.
                </div>
              )}
            </div>
          </div>

          <Composer value={draft} onChange={(e) => setDraft(e.target.value)}
                    saveState={draft ? saveState : "none"} submitting={sending}
                    onSubmit={send} onPreview={() => {}}
                    collapsed={!editorOpen} onToggleCollapse={() => setEditorOpen((v) => !v)} />
        </main>

        {rightOpen ? (
          <aside style={{ flex: "none", width: "var(--rail-right-w)", boxSizing: "border-box", background: "var(--surface-rail)",
                          borderLeft: "1px solid var(--border-subtle)", padding: "16px 14px",
                          display: "flex", flexDirection: "column", gap: "var(--space-9)", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <Label>Gruppen-Kontext</Label>
              <span onClick={() => setRightOpen(false)}
                    style={{ marginLeft: "auto", cursor: "pointer", fontSize: 13, color: "var(--text-label)",
                             padding: "2px 6px", border: "1px solid var(--border-default)", borderRadius: "var(--radius-xs)", lineHeight: 1.1 }}>›</span>
            </div>
            <StepList steps={steps} doneOpen={doneOpen} onToggleDone={() => setDoneOpen((v) => !v)}
                      onAdd={() => {}}
                      onToggle={(id) => setSteps((s) => s.map((x) => (x.id === id ? { ...x, done: !x.done } : x)))} />
            <StoryStatus fields={[
              { label: "Status", value: "Wird geschrieben", strong: true },
              { label: "Genre", value: "Fantasy, Mystery" },
              { label: "Perspektive", value: "3. Person, Vergangenheit" }]} />
            <FileList total={12} onAll={() => {}} files={[
              { name: "stadtkarte.png", type: "png" },
              { name: "mira-referenz.png", type: "png" },
              { name: "zeitleiste.md", type: "md" }]} />
            <MemberList members={[{ name: "Alice", role: "Admin" }, { name: "Bob", role: "Autor" }, { name: "Carol", role: "Leserin" }]}
                        onInvite={() => {}} />
          </aside>
        ) : (
          <RailToggle side="right" label="Gruppen-Kontext" onClick={() => setRightOpen(true)} />
        )}
      </div>
    </div>
  );
}
window.Kit = Object.assign(window.Kit || {}, { ThreadPage });
