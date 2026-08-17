Left-rail list of the member's writing groups.

```jsx
<GroupList
  groups={[{ id: "em", name: "Der Erinnerungsmarkt" }, { id: "ka", name: "Königreich aus Asche", unread: 3 }]}
  activeId="em"
  onSelect={setGroup}
  onCreate={openCreateDialog}
/>
```

Never nest threads under a group here. The active group is raised paper with a 1px border, not a
filled chip. Unread counts always carry the word "neu".
