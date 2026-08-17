Annotations on a post — always rendered inside a `Post`, never standalone in the thread flow.

```jsx
<Post author="Alice" time="Dienstag, 09:14" notesCount={2} notesOpen={open} onToggleNotes={t}>
  <p>…</p>
  {open && <NotesThread notes={notes} onWrite={write} />}
</Post>
```

Keep it collapsed by default. The 2px left rule is the only thing separating craft feedback from
narrative — do not drop it, and do not restyle annotations to look like posts.
