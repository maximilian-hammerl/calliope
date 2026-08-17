The writing surface — fixed at the bottom of the thread column, never inline in the scroll flow.

```jsx
<Composer
  value={draft} onChange={(e) => setDraft(e.target.value)}
  saveState={saving ? "saving" : "saved"}
  submitting={sending} onSubmit={send} onPreview={preview}
  collapsed={!editorOpen} onToggleCollapse={() => setEditorOpen(v => !v)}
/>
```

Never add a word or character counter, and never put a timestamp on the save state. Always drive
`submitting` from the real request so double submits are impossible. On mobile, render it collapsed
by default: it becomes the fixed one-line bar that expands on focus.
