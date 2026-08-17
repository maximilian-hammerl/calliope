Global top bar — every Calliope screen has exactly one.

```jsx
<TopBar active="Meine Gruppen" query={q} onQueryChange={(e) => setQ(e.target.value)} />
<TopBar compact />   {/* mobile: destinations move to BottomBar */}
```

The five destinations are fixed product-level areas; do not add a sixth without a product reason,
and never put group or thread names here — those belong in the left rail and the tab strip.
