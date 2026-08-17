Edge strip for a collapsed rail.

```jsx
{railOpen ? <LeftRail … /> : <RailToggle side="left" label="Gruppen" onClick={open} />}
{ctxOpen ? <ContextRail … /> : <RailToggle side="right" label="Gruppen-Kontext" onClick={open} />}
```

Both sides must look and behave the same. The chevron points where the rail will go. Inside an open
rail, the matching collapse control is a 4px-radius chevron button next to the section `Label`.
