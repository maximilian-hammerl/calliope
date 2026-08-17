# Calliope frontend integration

Drop-in replacement for `frontend/src/assets/main.css` in the `calliope` repo
(Vue 3 + Tailwind v4 + shadcn-vue). I can read your local folder but **cannot write
to it** — copy this file over yourself:

```
cp integration/main.css  <repo>/frontend/src/assets/main.css
```

## What changed vs. the shadcn default theme

| Token | Before | After | Calliope source |
|---|---|---|---|
| `--background` | white | `#f7f4ee` | `--paper-1` app canvas |
| `--foreground` | near-black | `#302a23` | `--ink-2` prose |
| `--card` / `--popover` | white | `#fffdf9` | `--paper-0` raised |
| `--primary` | neutral 0.205 | `#4f4132` | `--accent-deep` solid action |
| `--secondary` / `--accent` | neutral 0.97 | `#eee5d3` | `--paper-3` quiet fill / hover |
| `--muted` | neutral 0.97 | `#f2ede3` | `--paper-2` rails |
| `--muted-foreground` | neutral 0.556 | `#6d6153` | `--ink-5` |
| `--border` / `--input` | neutral 0.922 | `#e6dfd2` / `#ddd2bd` | `--line-3` / `--line-4` |
| `--ring` | neutral 0.708 | `#8a6a3a` | `--accent` (focus + caret) |
| `--sidebar*` | neutral | paper-2 / ink-3 family | `--surface-rail` |
| `--radius` | `0.625rem` | `6px` | `--radius-control` |
| fonts | IBM Plex Sans only | + Newsreader (serif/heading), IBM Plex Mono | `tokens/typography.css` |

Also added: the raw palette as Tailwind utilities (`bg-paper-1`, `text-ink-5`,
`border-line-4`, `text-oak`), `.prose-post` (the 17px/1.8 Newsreader reading
size that never shrinks) and `.label-rail` (uppercase mono rail label).

## Judgement calls to review

1. **Dark mode is an extrapolation.** Calliope defines no dark theme; the `.dark`
   block is a plausible ink-family inversion. Delete it or have it reviewed.
2. **Chart colours are not a real palette.** The system forbids a second hue, so
   `--chart-1..5` are oak/ink steps. Any real data-viz needs a design decision.
3. **shadcn defaults that conflict with Calliope:** shadcn rounds most surfaces
   and shadows cards. Calliope: nothing in the reading surface is rounded, and
   cards have **no** shadow (`--shadow-none`) — pass `class="rounded-none shadow-none"`
   on Card in reading contexts, or patch `components/ui/card` once.
4. Values are hex, not oklch, to stay byte-identical to the design system.
