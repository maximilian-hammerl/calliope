Search input for the top bar; search was named a must-have in member research.

```jsx
<SearchField value={q} onChange={(e) => setQ(e.target.value)} />
```

Keep the placeholder at "Suche". The border turns `--focus-ring` on focus — this is the one input
in the system whose focus is drawn on the border rather than as an outline ring.
