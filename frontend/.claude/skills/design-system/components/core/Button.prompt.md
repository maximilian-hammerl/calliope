Action button in the four Calliope levels — use it for every clickable action; never style a raw `<button>`.

```jsx
<Button level="solid" size="lg" onClick={send}>Beitrag senden</Button>
<Button level="outline">Vorschau</Button>
<Button level="quiet" block>Mitglied einladen</Button>
<Button level="plain">Antworten</Button>
```

Only ONE `solid` button per screen region — the primary act. `quiet` carries affirmative side
actions and is intentionally strong enough to be noticed (test feedback: the invite button was too
easy to miss). `plain` is for the row of per-post actions and has no padding. Hover darkens one
step; there is no lift, no scale and no colour change. Labels are sentence case German verbs
("Beitrag senden", not "Senden!").
