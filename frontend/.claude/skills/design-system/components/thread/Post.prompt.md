A single post. Compose posts directly under one another inside a max-684px column.

```jsx
<Post author="Alice" time="Dienstag, 09:14" notesCount={2} notesOpen={open} onToggleNotes={toggle}>
  <p>Der Markt öffnete immer erst, wenn das letzte Licht gewichen war.</p>
</Post>
<Post author="Bob" time="vor 12 Minuten" edited bookmarked divider={false}>
  <p>„Du willst etwas verkaufen", sagte er.</p>
</Post>
```

Do not add avatars, role badges, reaction buttons or reaction counts — all were built and removed on
feedback. Do not box the post. Keep the last post's `divider={false}`.
