# UI kit — Calliope desktop app

Screens
- **ThreadPage.jsx** — the accepted design (mockup `3a` in `Gruppen-Thread Mockups.dc.html`), the
  page this whole system was derived from. Interactive: switch threads, collapse either rail to its
  edge strip, collapse the editor, open/close annotations, tick steps, expand "Erledigt", type
  (autosave runs) and send a post (the submit button locks while sending).
- **GroupsIndex.jsx** — *extrapolation.* No mockup exists; reuses only tested patterns.
- **CreateGroupDialog.jsx** — *extrapolation.* Built because members asked that group creation force
  the standardising metadata (title, genre, perspective) so groups stay comparable.

Behaviour worth preserving when this becomes real code
- Autosave is visible and never timestamped; the spinner runs while saving.
- `submitting` locks the submit button — a flaky connection must not create a double post, while a
  member can still post twice in a row deliberately.
- Both rails collapse to the identical 34px edge strip; collapsing both plus the editor IS the
  reading mode. There is no separate mode.
- The right rail is group-level: identical content on every thread of the group.

Entry point: `index.html` (also registered as a starting point).
