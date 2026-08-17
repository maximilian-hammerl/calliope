/* EXTRAPOLATION — no mockup exists. Built because members asked that group creation
   FORCE the standardising metadata (title, genre, perspective) so groups stay comparable. */
function CreateGroupDialog({ onClose }) {
  const { Button, Label, Badge } = window.DS;
  const [name, setName] = React.useState("");
  const [genres, setGenres] = React.useState([]);
  const [visibility, setVisibility] = React.useState("Privat");
  const [perspective, setPerspective] = React.useState("");
  const genreOptions = ["Fantasy", "Mystery", "Romance", "Historisch", "Science-Fiction", "Drama"];
  const ready = name.trim() && genres.length && perspective;

  const field = { font: "var(--text-control)", color: "var(--text-title)", background: "var(--surface-raised)",
                  border: "1px solid var(--border-default)", borderRadius: "var(--radius-control)",
                  padding: "9px var(--space-5)", width: "100%", boxSizing: "border-box", outline: "none" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(43,38,32,.22)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-ui)" }}>
      <div style={{ width: 480, background: "var(--surface-app)", border: "1px solid var(--border-strong)",
                    borderRadius: "var(--radius-control)", padding: "var(--space-10)" }}>
        <h2 style={{ margin: "0 0 var(--space-3)", font: "var(--text-h2)", color: "var(--text-title)" }}>Gruppe gründen</h2>
        <p style={{ margin: "0 0 var(--space-9)", font: "var(--text-control)", color: "var(--text-muted)", lineHeight: 1.6 }}>
          Titel, Genre und Perspektive sind Pflicht — so finden andere die Gruppe und wissen, worauf sie sich einlassen.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-9)" }}>
          <label style={{ display: "block" }}>
            <div style={{ marginBottom: "var(--space-4)" }}><Label>Titel</Label></div>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Der Erinnerungsmarkt" style={field} />
          </label>

          <div>
            <div style={{ marginBottom: "var(--space-4)" }}><Label>Genre</Label></div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)" }}>
              {genreOptions.map((g) => {
                const on = genres.includes(g);
                return (
                  <button key={g} onClick={() => setGenres((s) => (on ? s.filter((x) => x !== g) : [...s, g]))}
                    style={{ font: "var(--text-control)", cursor: "pointer", borderRadius: "var(--radius-control)", padding: "6px 11px",
                             background: on ? "var(--action-quiet-bg)" : "var(--surface-raised)",
                             border: `1px solid ${on ? "var(--action-quiet-border)" : "var(--border-default)"}`,
                             color: on ? "var(--action-quiet-fg)" : "var(--text-secondary)",
                             fontWeight: on ? "var(--weight-medium)" : "var(--weight-regular)" }}>{g}</button>
                );
              })}
            </div>
          </div>

          <label style={{ display: "block" }}>
            <div style={{ marginBottom: "var(--space-4)" }}><Label>Perspektive</Label></div>
            <select value={perspective} onChange={(e) => setPerspective(e.target.value)} style={field}>
              <option value="">Bitte wählen</option>
              <option>1. Person, Gegenwart</option>
              <option>1. Person, Vergangenheit</option>
              <option>3. Person, Gegenwart</option>
              <option>3. Person, Vergangenheit</option>
            </select>
          </label>

          <div>
            <div style={{ marginBottom: "var(--space-4)" }}><Label>Sichtbarkeit</Label></div>
            <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
              {["Privat", "Öffentlich"].map((v) => (
                <button key={v} onClick={() => setVisibility(v)}
                  style={{ font: "var(--text-control)", cursor: "pointer", borderRadius: "var(--radius-control)", padding: "6px 11px",
                           background: visibility === v ? "var(--action-quiet-bg)" : "var(--surface-raised)",
                           border: `1px solid ${visibility === v ? "var(--action-quiet-border)" : "var(--border-default)"}`,
                           color: visibility === v ? "var(--action-quiet-fg)" : "var(--text-secondary)" }}>{v}</button>
              ))}
              <span style={{ font: "var(--text-hint)", color: "var(--text-muted)", marginLeft: "var(--space-3)" }}>
                {visibility === "Privat" ? "Nur eingeladene Mitglieder sehen die Gruppe." : "Die Gruppe erscheint in der Suche."}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-5)", marginTop: "var(--space-11)" }}>
          <Button level="outline" onClick={onClose}>Abbrechen</Button>
          <Button level="solid" size="lg" disabled={!ready} onClick={onClose}>Gruppe gründen</Button>
          {!ready && <span style={{ font: "var(--text-hint)", color: "var(--text-muted)" }}>Titel, Genre und Perspektive fehlen noch.</span>}
        </div>
      </div>
    </div>
  );
}
window.Kit = Object.assign(window.Kit || {}, { CreateGroupDialog });
