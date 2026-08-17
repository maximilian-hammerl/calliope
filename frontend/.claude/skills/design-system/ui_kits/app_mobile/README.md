# UI kit — Calliope mobile (390px)

**MobileThread.jsx** — the accepted thread page at phone width. The old platform had no mobile
layout at all, which members named as a top complaint, so this was designed alongside the desktop
view rather than after it.

What changes from desktop
- Destinations move from the top bar to a bottom bar; the wordmark and `Suche` stay top.
- Both rails become **sheets**: the right rail opens from the "Gruppen-Kontext" button in the group
  header, the left from "Gruppen" in the bottom bar. Sheets, not drawers — nothing slides over the
  text while reading.
- The composer is a fixed one-line bar that expands in place on tap.
- `MemberList` is rendered with `sticky={false}` inside the sheet (it only pins in a rail).

What does NOT change
- Prose stays 17px/1.8. The reading size is never reduced.
- Threads stay tabs, scrolling horizontally — never a dropdown.
- Every target is at least `--tap-min` (44px).
- No counters, no reactions, no role badges on posts.
