Initial-only avatar — the only representation of a person in Calliope.

```jsx
<Avatar name="Alice" />
<Avatar name="Bob" size="sm" />
```

Never generate an image, gradient or colour-per-user; every avatar uses `--surface-avatar`. In the
thread itself avatars are omitted entirely — posts identify their author in text — so this is mostly
a rail and header component.
