# Calliope Design System

Calliope is a working name for a modern replacement of **Yooco**, a German-language platform for
collaborative fiction writing. Members form small **writing groups**, each group holds **threads**
(chapters, planning, characters, worldbuilding), and members write **posts** into those threads —
long-form prose, often several paragraphs, over months. Roles are `administrator`, `member`
(writes) and `reader` (reads, may comment). Groups are `private` or `public`; most real use is
private.

This system was derived from the **group thread page** — by the project's own research the surface
where members spend nearly all of their time — designed, reviewed by Yooco members across two rounds,
and consolidated into one direction.

## Sources

- Local codebase folder `calliope/` — Deno + Kysely backend. Ground truth for the data model:
  `calliope/backend/src/database/schema.ts` (users, sessions, writing_groups, roles, visibility).
  No frontend existed at the time this system was written; **there is no prior UI to copy.**
- `calliope/docs/product-requirements-feature-specification.md` — product requirements & feature
  spec (~1,900 lines), including accessibility and progressive-enhancement requirements.
- `calliope/docs/interviews.md` — interview guide and transcripts with Yooco members.
- Project `Gruppen-Thread Mockups.dc.html` — the three design rounds. Section `3a` is the accepted
  direction and the visual source of truth for everything here.
- Two rounds of written feedback from Yooco members.

**There is no logo and no brand mark.** Nothing in the sources contains one. Wherever a mark would
sit, the system sets the word *Calliope* in Newsreader 600. Do not draw or invent one.

## What the research demands

These are not style preferences; they are findings the design must honour:

1. **No pressure mechanics.** No coin balances, no rankings, no profile-view counts, no streaks —
   the old platform's stats made members anxious. Word counters were rejected for the same reason:
   *"Wörterzähler uninteressant und führt zu einem Druckgefühl."* If a counter ever ships, it must
   be off by default and easy to disable.
2. **Nothing duplicated.** Threads live in tabs, so they must not also appear in the left rail.
   The group's privacy is stated once, next to its title, never repeated in a rail.
3. **Everything in the right rail is group-level**, identical across all threads of that group:
   next steps, story status, files, members. Never per-thread.
4. **The writing surface must not lose work.** Autosave is visible and continuous
   ("Entwurf wird gespeichert" with a spinner, no timestamp). Double-submits must be impossible;
   two consecutive posts by the same person must remain possible.
5. **Calm, warm, supportive.** Warm paper beat neutral grey in testing on emotional grounds:
   *"beige gefällt mir als farben besser, weil wärmer"* / grey *"fühlt sich emotionslos an."*
6. **Sparse rounding.** *"Zu viele abgerundete Ecken. Fühlt sich damit überladen an."*
7. **Collapsibility instead of modes.** A separate reading mode was rejected as unnecessary once
   both rails and the composer can collapse.
8. **Mobile is not optional.** The old platform had no mobile layout at all; that was a top
   complaint.

## Content fundamentals

**Language.** German throughout, informal **Du** (never *Sie*). Grammatical gender follows the
person: *Autor* / *Leserin*. Umlauts and ß always correct; German quotation marks („…") in prose
and in UI copy alike.

**Sentence case, always.** Labels are sentence case ("Mitglied einladen", "Beitrag senden"), never
Title Case and never ALL CAPS — with the single exception of the mono rail labels
("MEINE GRUPPEN", "GRUPPEN-KONTEXT"), where the caps are a typographic device.

**Verbs are what the member does, not what the system does.** "Weiterschreiben", not "Neuer
Beitrag". "Merken", not "Zu Lesezeichen hinzufügen". "Gruppe gründen", not "Gruppe erstellen" —
founding a group is a social act.

**System state is stated plainly and without exclamation.** "Entwurf wird gespeichert" ·
"Entwurf gespeichert" · "14 Beiträge · zuletzt vor 12 Minuten von Bob" · "3 offen" ·
"Erledigt (5)". No "Super!", no "Ups!", no exclamation marks anywhere.

**Numbers get a noun.** A bare badge number was tested and misread — nobody could tell what "3"
meant. Always "3 neu", "6 von 12 Threads", "2 Anmerkungen", "Erledigt (5)".

**Relative time under a day, absolute above it.** "vor 12 Minuten" → "Dienstag, 09:14" →
"12. Februar". Edits are disclosed quietly, appended: "· bearbeitet".

**Reassurance is factual, not warm-fuzzy.** "Privat — nur Alice, Bob und Carol sehen diesen
Thread." State who can see it; do not promise safety.

**No emoji. Anywhere.** Emoji reactions were built in round 1 and explicitly removed. The only
non-alphabetic glyphs allowed are the interface marks listed under Iconography.

**Copy examples to reuse verbatim:** Weiterschreiben · Beitrag senden · Vorschau · Antworten ·
Zitieren · Merken · Anmerkung schreiben · Mitglied einladen · Gruppe gründen · Thread ·
Schritt · Alle Beiträge · Nächste Schritte · Story-Status · Dateien & Bilder · Suche ·
Editor einklappen · Editor ausklappen · Gruppen-Kontext.

## Visual foundations

**The idea.** A quiet reading room. Warm paper, one ink, one accent, hairlines instead of boxes.
The member's prose is the only thing on screen allowed to be beautiful; everything the product
says recedes.

**Colour.** One warm paper ramp (`--paper-0` … `--paper-4`, `#fffdf9` → `#e5d9c2`), one ink ramp
(`--ink-1` … `--ink-6`, `#2b2620` → `#7d7364`), one accent — burnt oak `--accent` `#8a6a3a` with
`--accent-deep` `#4f4132` for solid actions. **No second hue.** Per-group colour coding was tried
and rejected ("Gruppen benötigen keine unterschiedliche Farben"). Colour never signals status,
quality or achievement. `--signal-error` / `--signal-ok` exist for form validation only and appear
in none of the mockups.

Surface hierarchy is inverted from the usual convention: rails are **recessed** (`--paper-2`), the
canvas sits above them (`--paper-1`), and the raised surfaces (`--paper-0`) are the top bar, the
composer, the active tab and inset panel cards. Depth comes from these three values plus
hairlines — never from shadow.

**Type.** Newsreader (serif) for everything a member writes and for all headings; IBM Plex Sans for
all interface chrome; IBM Plex Mono only for uppercase rail labels and file-type tags. Posts are
17px/1.8 — generous, book-like. Headings stay at 400 weight: a group title is 25px Newsreader
regular, not bold. Interface text runs 11.5–13.5px. Prose always carries `text-wrap: pretty`.
Metadata (author · time) sits at 12px in `--ink-6` — deliberately recessed, per feedback that post
headers were competing with the writing. Production serves all three families from its own
origin as subsetted WOFF2 rather than from Google, so no page makes a third-party request; the
typefaces and their axes are unchanged.

**Backgrounds.** Flat colour only. No images, no gradients, no textures, no patterns, no
illustrations. The one exception is the diagonal hatch placeholder used for image thumbnails that
have no asset yet.

**Borders and dividers.** 1px hairlines carry all structure. Posts are separated by a full-width
`--border-divider` rule with `--post-gap` (26px) above and below — boxed posts were rejected in
round 1, but round 2 showed posts need *some* separation. 2px is used only twice: the active tab
underline and the vertical rule marking a notes/quote block.

**Corner radii.** Deliberately sparse: `--radius-tag` 3px (privacy badge, "gemerkt" tag),
`--radius-xs` 4px (rail toggles), `--radius-control` 6px (buttons, inputs, filter menu, panel
cards), `--radius-circle` for avatars only. **Reading surfaces are never rounded.**

**Cards.** There are no cards in the reading column. In the right rail, "panel cards" are
`--surface-raised` on `--surface-rail`, 1px `--border-subtle`, `--radius-control`, 9–10px padding,
**no shadow**.

**Shadow.** Effectively unused. `--shadow-drag` appears only under an element being dragged;
`--shadow-sheet` only under a mobile bottom sheet. Nothing at rest casts a shadow.

**Transparency and blur.** None. No glass, no scrims, no protection gradients. Sticky elements
(the tab strip, the sticky Mitglieder block) sit on solid paper so text never overlaps text.

**Buttons.** Three levels, no more. *Solid* — `--action-solid-bg` fill, `--text-on-solid`, 6px
radius, for the one primary act of a screen ("Beitrag senden"). *Quiet* — `--surface-quiet` fill,
1px `--border-strong`, `--accent-deep` text, 500 weight ("Mitglied einladen", "＋ Schritt",
"＋ Gruppe gründen", "Vorschau"); this level was strengthened after feedback that the invite button
was too easy to miss. *Plain* — text only in `--ink-5`, for per-post actions.

**States.** Hover darkens by one ink or paper step (solid → `--accent-deeper`; quiet →
`--paper-4`; plain → `--ink-4`); never a colour change and never a lift. Press is a further step
down with no scale transform. Focus is a 2px `--focus-ring` outline at 2px offset — visible and
never removed; the spec requires keyboard operability throughout. Active navigation is a 2px
underline in `--accent`, and active rail rows are `--paper-0` with a 1px `--border-default` — never
a filled chip. Disabled is `--ink-6` on `--paper-2` with no border change.

**Motion.** Almost none. Rails and the composer collapse in 220ms with `--ease`
(`cubic-bezier(.2,0,.2,1)`) — a size change, no slide-in, no fade-through. The autosave spinner is
the only looping animation in the product. No bounces, no attention-seeking motion; everything
honours `prefers-reduced-motion`.

**Layout rules.** Fixed top bar (54px). Both rails collapse to a 34px edge strip with a vertical
mono label and a chevron — the strip is the affordance to reopen, and left and right behave
identically. The thread tab strip is sticky under the group title and scrolls horizontally with
its scrollbar hidden; nothing else lives inside the scroll container. Posts scroll; the composer
is fixed to the bottom of the thread column and can itself collapse to a single line. The reading
column is capped at 684px regardless of window width. The Mitglieder block is sticky to the bottom
of the right rail.

**Density.** Roughly one reading column of ~65 characters, 26px between posts, 20–22px between
rail sections, 7px between rows inside a section. Comfortable, not airy; the tested "too dense"
direction packed three columns of tooling and lost.

**Mobile.** Single column, `--thread-gutter-mobile` 18px. The top bar keeps the wordmark and
search; primary navigation moves to a bottom bar. Threads stay tabs — a horizontally scrolling
strip under the group title. Both rails become sheets reachable from the group header ("Gruppen-Kontext")
rather than drawers that cover the text. The composer is a fixed single-line bar that expands to
full height when focused. Prose stays 17px — never shrink the reading size. Every target is at
least 44px (`--tap-min`).

## Iconography

The sources contained **no icon set, no icon font and no SVG assets**, and the system first ran
on words plus a handful of unicode marks. It now uses **Lucide at 1.5px stroke** — the weight
this document already named as the closest match to its hairlines — because the marks turned
out not to be there: `＋` `⌄` `⌃` `▾` `☐` are absent from Newsreader, IBM Plex Sans *and* IBM
Plex Mono, so every one of them was drawn by whichever font the browser fell back to. They
never matched the hairline weight and changed shape from platform to platform.

| Was | Now | Use |
| --- | --- | --- |
| `＋` (U+FF0B) | `Plus` | prefix on additive actions: Thread, Schritt, Gruppe gründen |
| `‹` `›` | `ChevronLeft` `ChevronRight` | collapse / expand a rail (direction points where it will go) |
| `⌄` `⌃` | `ChevronDown` `ChevronUp` | collapse / expand the composer |
| `▸` `▾` | `ChevronRight` `ChevronDown` | closed / open disclosure ("Erledigt (5)") |
| `▾` | `ChevronDown` | menu affordance ("Alle Beiträge") |
| `☐` `☑` | `Square` `SquareCheck` | open / done step in Nächste Schritte |
| `⌕` | `Search` | search |
| `⠿` | `GripVertical` | drag handle (only if drag-reorder ships) |

Every icon states `stroke-width="1.5"`; Lucide's own default is 2, which is heavier than
anything else on the page. Size them to the text they sit beside — 14px against 12.5–13.5px
interface text — and let them inherit `currentColor` rather than carrying a colour.

**Words still come first.** An icon accompanies a label, it does not replace one: the buttons
read "Gruppe gründen" and "Thread", with the mark in front. Nothing becomes an icon-only
control.

Unchanged: file types stay mono text (`PNG` `MD` `JPG`), never a file icon. Avatars are
initials on `--surface-avatar`, never generated images. **No emoji** — the round-1 emoji
reactions were removed on explicit feedback.

The prototype components under `components/` and `ui_kits/` still render the unicode marks;
they have no Lucide dependency and are for throwaway mockups. The production interface is the
reference for this decision.

## Index

- `styles.css` — the entry point consumers link. `@import` lines only.
- `tokens/` — `fonts.css` (Google Fonts import, for prototypes; production self-hosts the
  same families as subsetted WOFF2), `colors.css`, `typography.css`, `spacing.css`,
  `borders.css`, `motion.css`, `base.css` (resets + three utility classes).
- `guidelines/` — foundation specimen cards (Type, Colors, Spacing, Brand).
- `components/core/` — Button, Badge, SearchField, Avatar, PanelCard, Label
- `components/navigation/` — TopBar, GroupList, ThreadTabs, RailToggle
- `components/thread/` — GroupHeader, ThreadHeader, Post, NotesThread, Composer
- `components/context/` — StepList, MemberList, FileList, StoryStatus
- `ui_kits/app_desktop/` — the accepted desktop thread page and its neighbours.
- `ui_kits/app_mobile/` — the same product at 390px.
- `SKILL.md` — lets this folder be used as an Agent Skill.

### Intentional additions

Everything below has no direct counterpart in the mockups and was added because a real product
needs it. Each is marked so nobody mistakes it for tested ground:

- `SearchField` as a real input (the mockups only show its resting state in the top bar).
- `--signal-error` / `--signal-ok` for form validation.
- `Avatar`, `Label`, `PanelCard` — extracted as primitives from patterns that repeat in the mockup.
- Lucide as the icon set, at 1.5px stroke — anticipated by this document, adopted once the
  unicode marks proved to be missing from all three fonts.
