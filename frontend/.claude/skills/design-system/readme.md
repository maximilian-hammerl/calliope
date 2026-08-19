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

**The mark is the Versal C** — the capital C of Newsreader, the face the wordmark and all member
prose are set in. Nothing in the original sources contained a logo, and for a while the system had
none: wherever a mark would sit, it set the word *Calliope* in Newsreader 600. The C keeps that
principle rather than breaking it. Nothing was invented; the letter *is* the typeface, which is the
honest mark for a product in which typography is everything.

It is **outlined from the font**, not set as live text, so it renders identically with no webfont
loaded — as an `<img>`, in email, at a printer. Do not recreate it by typing "C" in Newsreader, and
do not draw a second mark beside it.

**Two cuts, and the boundary is 32/33.** The regular cut is outlined at optical size 36, the small
one at optical size 8, where Newsreader is drawn with sturdier strokes for small text. Below 33px
the regular cut's thin top and bottom drop out, which is precisely what the `opsz` axis exists to
fix — so the small cut is the same letter at its own optical size, not a thickened copy. The
product's nav mark is 22px and therefore uses the small cut.

**Lockup geometry**, stated identically in the SVG, the `CalliopeLogo` component and the asset set:
the gap between mark and wordmark is **0.45 × the mark height**, and the wordmark is set at
**0.73 × the mark height** in Newsreader 600, `#3a3229`. The two share a baseline — the letter's own
baseline sits 57.14 down its 64-unit box, so the mark hangs below the box's bottom edge by the
overshoot. At the nav's 22px that is a 10px gap and a 16px wordmark.

**Colour.** Ink `#2b2620` on paper, cream `#fffdf9` on `--accent-deep` `#4f4132` or any dark ground.
Never in `--accent` `#8a6a3a`, never two-tone, never on a photograph, never with a gradient or a
shadow. Clear space on all four sides is 0.25 × the mark height, measured from the box rather than
from the ink. Minimum size is 16px on screen with the small cut.

Do not rotate, stretch, add a keyline, or place it in a circle or a rounded square other than the
supplied tile.

## What the research demands

These are not style preferences; they are findings the design must honour:

1. **No pressure mechanics.** No coin balances, no rankings, no profile-view counts, no streaks —
   the old platform's stats made members anxious. Word counters were rejected for the same reason:
   *"Wörterzähler uninteressant und führt zu einem Druckgefühl."* If a counter ever ships, it must
   be off by default and easy to disable.
2. **Nothing duplicated.** Threads live in tabs, so they must not also appear in the left rail.
   The group's privacy is stated once, next to its title, never repeated in a rail.
   *One deliberate exception:* members appear both in the rail and on the group page. The two
   are not the same thing — the rail answers "who is here" while reading, the page is where an
   administrator invites and removes. The rail carries no actions at all, so nothing is offered
   twice; the "Mitglied einladen" button that used to sit there was moved to the page.
3. **Everything in the right rail is group-level**, identical across all threads of that group:
   next steps, story status, files, members. Never per-thread.
4. **The writing surface must not lose work.** Autosave is visible and continuous
   ("Entwurf wird gespeichert" with a spinner, no timestamp). Double-submits must be impossible;
   two consecutive posts by the same person must remain possible.
   A failed save says "Entwurf nicht gespeichert" and **changes nothing else** — the text stays
   exactly where it is and the next keystroke tries again. Never clear a composer to reflect a
   state the server has; the member's copy is the one that matters.
   A draft is private until it is published, so writing one moves no timestamp anybody can see:
   the thread does not jump to "zuletzt gerade eben" and the group list does not reorder while
   somebody is composing in silence.
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

**In a strip, the create action is the bare noun.** "+ Thread" in the tab strip, "+ Gruppe" in
the left rail — the `Plus` carries the verb, and the full phrase ("Thread anlegen", "Gruppe
gründen") is the title of the dialog it opens and its `aria-label`, so nothing is lost to a
screen reader. Everywhere else the verb is written out. The action sits in the strip with a
transparent segment of the rule, which is what separates it from the items.

**One action, one place per screen.** The rail's create button is the only one from `md` up; the
Meine-Gruppen page carries its own below that breakpoint, because there is no rail on a phone.
Two buttons for one action on one screen is what this replaced.

**Verbs are what the member does, not what the system does.** "Weiterschreiben", not "Neuer
Beitrag". "Merken", not "Zu Lesezeichen hinzufügen". "Gruppe gründen", not "Gruppe erstellen" —
founding a group is a social act.

**System state is stated plainly and without exclamation.** "Entwurf wird gespeichert" ·
"Entwurf gespeichert" · "Entwurf nicht gespeichert" · "14 Beiträge · zuletzt vor 12 Minuten von Bob" · "3 offen" ·
"Erledigt (5)". No "Super!", no "Ups!", no exclamation marks anywhere.

**A limit is stated when it is reached, never as a running total.** Short fields simply stop
accepting input at the bound. Prose fields — a group description, a post — accept whatever is
typed and say why on submit, keeping the draft: "Der Beitrag ist zu lang. Er darf höchstens
100.000 Zeichen haben." No live counter, on either kind; that is the word-counter finding
again, and the same pressure. Limits read as German numerals: 100.000, not 100000.

**Numbers get a noun.** A bare badge number was tested and misread — nobody could tell what "3"
meant. Always "3 neu", "6 von 12 Threads", "2 Anmerkungen", "Erledigt (5)".

**A membership shows one date, the one its state is about**: "eingeladen vor 3 Tagen" while an
invitation is pending, "beigetreten vor 2 Tagen" once it has been accepted. Both are participles
and both take the usual relative-then-absolute time. When somebody is in the group, when they
were asked is no longer what a reader wants to know.

**Relative time under a day, absolute above it.** "vor 12 Minuten" → "Dienstag, 09:14" →
"12. Februar". Edits are disclosed quietly, appended: "· bearbeitet".

**Reassurance is factual, not warm-fuzzy.** "Privat — nur Alice, Bob und Carol sehen diesen
Thread." State who can see it; do not promise safety.

**Say what a field will be used for, beside the field.** Registration states it for both:
"Andere Mitglieder sehen deinen Benutzernamen und finden dich darüber. Wähle nichts, was privat
bleiben soll." and "Deine E-Mail-Adresse sieht niemand außer dir. Sie wird weder anderen
Mitgliedern angezeigt noch weitergegeben." Both are `FieldDescription`, not a link to a policy
page — the moment someone is choosing a username is the only moment the choice is still free,
and it cannot be changed afterwards. Note the form: what happens to the value, then what the
member should do about it. Never "wir schützen deine Daten".

**No emoji. Anywhere.** Emoji reactions were built in round 1 and explicitly removed. The only
non-alphabetic glyphs allowed are the interface marks listed under Iconography.

**The top bar is shared; the avatar menu is personal.** The bar carries what everyone has in
common and what stays put — Meine Gruppen, and the search the system reserves room for.
Anything belonging to one member lives behind their avatar: Mitteilungen, Nachrichten,
Einstellungen, Abmelden. That split is also what keeps the bar from growing: two long German
nav words plus the lockup do not fit a 375px phone, and every future personal feature would
have pushed harder.

**„Mitteilungen", not „Benachrichtigungen".** The shorter word is the one German interfaces use
for this (it is Apple's), and it leaves „Nachrichten" free for private messages later.

**Personal things open where you are.** Mitteilungen is a dialog, not a page: somebody halfway
through a long post who wants to answer something should not lose the page they are on. The
same will hold for Nachrichten. A dialog is right while the content is a single list; the
moment it needs the categories the requirements describe, it has outgrown one.

**One mark, not a number, and never both.** An unread notification puts a 7px `--oak` dot on
the avatar and nothing else. A count in the bar tells you how far behind you are, which is the
pressure the research warned about; a dot only says something happened. The number is said
once, with its noun, on the menu item itself („Mitteilungen · 3 neu").

**A change to who can see the writing is said outright.** „mira hat „Der Erinnerungsmarkt"
öffentlich gemacht. Alle können jetzt mitlesen." — the consequence, not just the setting. It is
the one notification about a group's own state that changes who may read what its members
wrote, and the system's rule is to state who can see something rather than promise safety.

**A pending invitation names who sent it**: „eingeladen vor 3 Tagen von mira". Only while it is
pending — once somebody has joined, who opened the door stops being what a reader wants.

**A role reads as a clause, not as a column heading.** „Admin", „Schreibt" and „Liest" label a
column in the member list and read badly in a sentence — „geändert: Liest." In prose the role
becomes what it lets you do: „Du verwaltest die Gruppe.", „Du schreibst mit.", „Du liest mit."
Verbs also keep it neutral, where a noun would force a guess at somebody's gender.

**A notification is one line, and unread is a matter of ink.** Hairline rows, the sentence in
`--ink-1` at medium weight while unread and `--ink-4` once read, the time right-aligned in
`--ink-6`. Opening the list is what marks it read — nobody dismisses lines one at a time.
Weight alone turned out to be too quiet to find when a single row is unread, so it is joined by a
5px `--oak` dot in a fixed gutter at the left, empty on the rows that have been read so both stay
aligned. It is still one mark and still not a count.

**Copy examples to reuse verbatim:** Weiterschreiben · Beitrag senden · Vorschau · Antworten ·
Zitieren · Merken · Anmerkung schreiben · Mitglied einladen · Gruppe gründen · Thread ·
Schritt · Alle Beiträge · Nächste Schritte · Story-Status · Dateien & Bilder · Suche ·
Editor einklappen · Editor ausklappen · Gruppen-Kontext · Gruppe bearbeiten ·
Änderungen speichern · Entfernen · Einladung zurückziehen.

**„Meine Gruppen" means the ones you belong to.** Being allowed to read a public group is not
belonging to it, and a list that mixes the two answers neither question — a member seeing three
entries could not tell which were theirs. So the page and the rail both show joined groups only,
public ones the member is not in live under **Gruppen entdecken**, and pending invitations are a
section above the heading on Meine Gruppen. Three lists, one question each.

**An invitation is answered where it is found.** It carries Beitreten and Ablehnen both in that
section and on the group's own page, because deciding about three invitations should not be three
visits, and because the notification leads to the group rather than to the list. Declining is the
same act as leaving — both end with no membership — and returns the member to Meine Gruppen, since
a declined private group stops being readable. Invitations stay out of the left rail: the rail is
what you are in.

**Discovery states what it does not offer.** A public group can be read by anyone but joined only
by invitation, so its row offers "Gruppe ansehen" and the page says so in words — "Mitlesen kannst
du sofort; mitschreiben, sobald dich jemand einlädt." A "Beitreten" button that would fail is
worse than no button.

**A pending invitation is a state, not a member.** It reads "· eingeladen" after the role, and
a member count counts only those who have joined — an invitation is not yet a person in the
group. Withdrawing one is "Einladung zurückziehen", never "Entfernen": nothing is being taken
away from anybody.

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
round 1, but round 2 showed posts need *some* separation. 2px marks a current position — the
active tab underline, the active group's rule in the left rail — and the vertical rule of a
notes/quote block.

**Inactive tabs are underlined too**, at 1.5px in `--line-5`. A transparent underline left them
looking like plain words beside the active tab; the lighter rule says they are the same kind of
thing, one seat along. 1.5px is the only place a third weight is used, and it exists so the
active tab still wins on thickness as well as colour.

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

**Anything pressable takes a pointer**, and only what is disabled takes the arrow. Tailwind's
preflight supplied this for buttons until v4 dropped it, so the rule is stated once in the app's
base layer — never as a utility per control, or the next control to be written will go without.
It has to name roles as well as elements: a menu item or a tab from reka-ui is a `div`, and the
browser gives a `div` nothing. A row that leads somewhere also carries a `ChevronRight` at rest
rather than only on hover, because touch never hovers.

The base layer states the default and a utility is the deliberate exception, which is what keeps
this to one declaration. shadcn ships `cursor-default` on its dropdown and select rows and
`cursor-not-allowed` on disabled fields; both were restating a Tailwind v3 default rather than
overriding it, so they are **deleted** rather than inverted, and the base rule reaches the rows
through their reka-ui roles. A utility beats the base layer whatever the selector, so a leftover
one wins silently — and the shadcn CLI puts them back on update, so re-check after one. What stays
in a component is only what the base rule cannot say: a `Label` whose *peer* is disabled. Disabled
is `cursor: default` throughout, including form fields, `not-allowed` being louder than anything
else this product does with a disabled control.

**Motion.** Almost none. Rails and the composer collapse in 220ms with `--ease`
(`cubic-bezier(.2,0,.2,1)`) — a size change, no slide-in, no fade-through. The autosave spinner is
the only looping animation in the product. No bounces, no attention-seeking motion; everything
honours `prefers-reduced-motion`.

**Selection is a rule, never a box.** The left rail lists groups the way the thread strip lists
threads, turned on its side: a continuous 2px rule down the left of the column, the active
segment in `--oak`, the rest in `--line-4`. Rows sit flush so the rule is unbroken, which is what
says they are one set. The earlier treatment — the active row as raised paper with a hairline and
a radius — was dropped: it read as a card rather than a position, and it left the other rows with
no affordance at all. Hover matches the tabs exactly (text to `--ink-1`, rule one shade darker);
no fill, or a hovered row would look more selected than the selected one.

**The group title is the way back.** Above a thread it is a link to the group page, underlined on
hover at 6px offset. On the group page itself it is the heading and links nowhere — the same
component, told which it is rather than guessing from the route.

**Layout rules.** Fixed top bar (54px). Both rails collapse to a 34px edge strip with a vertical
mono label and a chevron — the strip is the affordance to reopen, and left and right behave
identically. The thread tab strip is sticky under the group title and scrolls horizontally with
its scrollbar hidden; nothing else lives inside the scroll container. Posts scroll; the composer
is fixed to the bottom of the thread column and can itself collapse to a single line. The reading
column is capped at 684px regardless of window width, and is **centred** in whatever space the
rails leave — left-aligning it stranded up to 278px of void beside it on a wide screen. Bands
that carry a full-width border (group header, thread tabs, composer) keep the border spanning
rail to rail and centre only their content, so the banding still reads as horizontal while the
text lines up with the posts. The `.reading-column` class in `styles/base.css` is the one
place this is expressed. The Mitglieder block is sticky to the bottom
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
| — | `Pencil` | edit an existing thing ("Gruppe bearbeiten") |

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
- `guidelines/` — foundation specimen cards (Type, Colors, Spacing, Brand, Interactive states).
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

- `SearchField` as a real input, with the popover under it (the mockups only show its resting
  state in the top bar). Results are grouped by kind under mono-ish 11.5px headings — Gruppen,
  Threads, Mitglieder — five per kind, and a section that found nothing is omitted rather than
  shown empty. Under each section, „N weitere Treffer" when there are more, because a number
  gets a noun and an imprecise search should say so rather than look complete.
  **A result that can come from anywhere says where it came from**: a thread carries its
  group's title beneath it, for the same reason a notification about a post names both.
  A member has nowhere to go until profiles exist, so those rows are text rather than links.
  From `md` up the field sits in the top bar; below that it takes its own full-width row under
  it, because the bar had 29px to spare and the wordmark would have paid for it.
- `--signal-error` / `--signal-ok` for form validation.
- `Avatar`, `Label`, `PanelCard` — extracted as primitives from patterns that repeat in the mockup.
- Lucide as the icon set, at 1.5px stroke — anticipated by this document, adopted once the
  unicode marks proved to be missing from all three fonts.
- **Gruppen entdecken** as its own destination, and the Einladungen section above Meine Gruppen.
  The mockups show one list of groups; one list cannot be "mine", "on offer" and "out there" at
  once, and the accepted design predates there being invitations to answer at all.
- `Pencil` for editing, and the member-management section on the group page (invite, remove,
  withdraw an invitation). The mockups show members only as the rail's read-only list; a group
  whose membership cannot be changed is not a usable product. "Gruppe bearbeiten" sits on the
  group page alone and never in `GroupHeader`, which also renders above a thread, where it would
  put an administrative control beside the writing.
