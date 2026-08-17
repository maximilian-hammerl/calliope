Group members, sticky at the bottom of the right rail.

```jsx
<MemberList
  members={[{name:"Alice",role:"Admin"},{name:"Bob",role:"Autor"},{name:"Carol",role:"Leserin"}]}
  onInvite={openInvite}
/>
```

The rail must be `display:flex; flex-direction:column; overflow-y:auto` for the sticky bottom to
work. Do not show roles next to post authors — this is the one place roles are stated.
