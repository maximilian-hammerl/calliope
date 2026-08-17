Thread navigation for a group — tabs, on every viewport including mobile.

```jsx
<ThreadTabs threads={threads} activeId={tid} onSelect={setTid} onCreate={newThread} />
```

Never convert this to a dropdown or a left-hand list: tabs were the members' explicit request, and
threads in the left rail were rejected as duplication. Keep the thread count ("6 von 12 Threads") in
the GroupHeader, not in the strip — a trailing item inside the scroller becomes invisible.
