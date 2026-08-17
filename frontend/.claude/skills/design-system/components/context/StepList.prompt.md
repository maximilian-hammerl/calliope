Group-level task list for the right rail.

```jsx
<StepList steps={steps} onToggle={toggle} onAdd={add}
  doneOpen={doneOpen} onToggleDone={() => setDoneOpen(v => !v)} />
```

Never scope it to a thread — it is group state. Never render completed steps inline with open ones.
"＋ Schritt" is a real `quiet` Button, not a text link (explicit feedback).
