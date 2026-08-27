# Calliope Design System

Calliope is a working name for a modern replacement of **Yooco**, a German-language platform for
collaborative fiction writing. Members form small **writing groups**, each group holds **threads**
(chapters, planning, characters, worldbuilding), and members write **posts** into those threads —
long-form prose, often several paragraphs, over months. Roles are `administrator`, `writer`
and `reader`. Groups are `private` or `public`; most real use is
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
2. **Nothing duplicated.** The group's privacy is stated once, next to its title, never
   repeated in a rail.
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
("ÜBER DIE GRUPPE", "GRUPPEN-KONTEXT"), where the caps are a typographic device.

**A "＋" action is the bare noun.** "＋ Thread", "＋ Gruppe", "＋ Schritt", "＋ Chat" —
never "＋ Gruppe gründen". The plus carries the verb; the full phrase is the title of the dialog
it opens and the button's `aria-label`, so a screen reader loses nothing. Everywhere else the verb
is written out. In a strip the action takes a transparent segment of the rule, which is what
separates it from the items.

**A list somebody hunts through pages by number; one that is read through loads more.** The two
look like the same problem and are not. Writers read earlier posts *for reference while
composing*, and somebody with fifteen groups is looking for one of them — both want to jump to a
known place, so both get numbered pages. A page is about a screenful, so the size follows the
row: ten where a row is a paragraph (groups, story ideas), twenty where it is a line or two
(posts, members, Mitteilungen). Who is in a group is the exception with no pages at all — a
member missing from that list is worse than a long one. In a thread the
strip sits above and below the list, below because that is where the composer already has them.
A conversation is read through, so it grows upward instead. Which end a thread starts at is the reader's choice, not a default: "Älteste
zuerst / Neueste zuerst", marked like every other position with the 2px oak underline.

**A choice the reader made belongs in the URL.** Page and order are query parameters, so a
reload, the back button and a second tab opened on the passage being quoted all keep their
place — which is most of what makes jumping feel quick. Defaults stay absent from the address,
so a plain link is still plain.

**Optional fields say so; required fields say nothing.** Marked this way round because the
problem is the opposite of the usual one: members filled Yooco's mandatory fields with nonsense
to get past them, so what a form has to communicate is permission to skip, not obligation to
answer. Silence therefore means required, which reads cleanly because required is the rare case —
one field of fourteen in the story-idea dialog. The word is `optional`, once per field, rendered
by `<FieldLabel optional>` rather than typed at each call site, and quieter than the label it
follows: it appears many times in a long form and it is reassurance, not instruction. No
asterisks — they are a convention people misread, and a glyph carrying meaning is exactly what
the iconography rule excludes.

**A form whose every field is optional still marks every one of them.** Silence means required,
so a profile of seven unmarked fields would claim seven obligations — and this is the form where
that misreading costs most, since Yooco's mandatory fields are exactly what got filled with
nonsense. The sentence above the form says the same thing once in prose; the markers are what a
member reading only the field they are standing in still sees.

**A form that publishes what somebody writes says who will read it, before they write.** Above
the profile fields, not beside the save button: both halves, who can see it and who cannot —
„alle Mitglieder mit einem Konto … außerhalb von Calliope ist nichts davon sichtbar" — and then
what it is for, because a field somebody understands is a field they answer properly. This is
what stands in place of a per-field visibility setting, so it carries that weight rather than
being helper text.

**A profile is edited from the profile, not from Einstellungen.** „Profil bearbeiten" sits on
your own page as „Gruppe bearbeiten" sits on a group's — Einstellungen is the account, and a
profile is content other members read.

**A profile shows what was answered and nothing else.** No label over an empty value: a field
left blank is a question somebody chose not to answer, and a bare label reads as the page having
failed to load. A profile with nothing in it says so in one sentence — and on your own, says
where to fill it in.

**A select is marked only when one of its options is "Keine Angabe".** Then blank is a real
choice and the rule above applies. A select whose default is an answer — Sichtbarkeit is Privat,
Sprache is Deutsch — is answered rather than skipped, and marking it optional would invite
somebody to look for a blank that is not there. The distinction matters because silence means
required: an unmarked Konstellation would have claimed a field is compulsory when its first
option is "Keine Angabe".

**And each dialog names what it needs, in its own description.** "Nur der Titel ist nötig",
"Nur Titel und die Idee selbst sind nötig" — one sentence where the reader looks first, so the
per-field marks confirm something already said rather than carrying the whole message.

**A dialog is as wide as its purpose, and there are four.** The widths are named once in
`theme.css` — `max-w-dialog-confirm` (440px), `-form` (560), `-wide` (760), `-workspace` (960) —
because `sm:max-w-[440px]` copied into ten files is how every form ended up the width of a
confirmation. A confirmation stays narrow: its constraint is the measure of its prose, and
widening it reads worse. A field-heavy form takes 760 so its fields pair two to a row, which is
what actually fixes "awkward to work in" — width without pairing just makes a tall dialog wide.
Only Chats is a workspace, because it is two panes rather than a form.

**Width for the frame, measure for the prose.** They are not the same number. The messages in a
960px dialog ran to ninety-five characters until the list was capped at 520px: the pane and the
composer want the width, the sentences do not. Cap prose in px where the element's own font size
differs from the text's — a `ch` cap measures whatever the element inherits, which here was 16px
against 13.5px text and came out a third too wide.

**A conversation pane is a fixed viewport, and loading history never moves the reader.** The
message list has a set height and scrolls inside it — given only a minimum, the dialog grew with
the conversation until it ran off the screen and took the composer with it. Older messages arrive
behind an explicit "Ältere Nachrichten" rather than on scroll, because this list also moves when
a message arrives, and prepending compensates the scroll offset by exactly the height added, so
the line somebody was reading stays under their eyes.

**Consecutive lines from one person are one block.** A chat is remarks rather than posts, and
somebody firing off three of them wrote them once: the name and the time head the run, not every
line in it. A run breaks after five minutes, because one header carries one time and „vor 12
Minuten" must not stand over something said an hour later; it never spans a deleted account,
because every one of those reads „Gelöschtes Konto" and joining two would put one member's words
under another's name. The spacing then needs three steps rather than two — „Melden" 6px under the
message it reports, a run's own lines 14px apart, a new speaker 24px. With two it is ambiguous
which message the button belongs to, since the name that used to start every block is now only on
the first.

**A list's order is explained by what its rows show.** Sort by a column the row displays, or
the sequence reads as random. Meine Gruppen is ordered by last activity and each row says
"zuletzt vor …"; Einladungen by when the invitation arrived and each row says "eingeladen vor
…"; Mitglieder alphabetically, because a row there is a name and nothing else, so any other
order would be invisible. The corollary bites hardest where a list is capped: the sort then
decides *which* rows a member sees at all, not merely their sequence — Meine Gruppen was once
capped at ten and sorted by title, which could hide the group somebody writes in daily.

**One action, one place per screen.** The rule is per screen, not per product: "＋ Gruppe" sits
on the heading line of Meine Gruppen and of Gruppen entdecken — both places somebody realises
they want a group — but never twice on either. What it replaced was the true duplication: the
create button in the left rail *and* on the page it framed.

**Every title takes a line under it saying what the surface is for.** One or two short
sentences: what is here, then what you can do with it — "Wer hier schreibt. Öffne ein Profil, um
zu sehen, ob jemand zu dir passen könnte." These surfaces are reached cold, from a bottom-bar tap
or a mailed link, and a bare heading leaves the purpose to be guessed from the contents. Never
describe the control ("Hier kannst du …"), and promise only what the surface does: a line about
what is new is a lie until unread marks exist.

Three exceptions. A **status page** whose heading changes with the outcome explains itself in its
body instead. A **rail or sheet** shows its mono label alone — but a sheet still needs the
sentence as an `sr-only` description, because the dialog primitive points `aria-describedby` at
one whether or not it exists. And where the subject has its own description — a group's synopsis —
that *is* the line.

**A destination is named the same everywhere.** The button that leads to Gruppen entdecken says
"Gruppen entdecken", and the link back to Meine Gruppen says "Meine Gruppen" — the page's own
heading, not a paraphrase of it. Two names for one place reads as two places.

**Title left, actions right.** A heading and the actions on its subject share one line, actions
pushed right with `ml-auto`, wrapping onto their own line when the width runs out. "Mitglieder ·
3 Mitglieder · [＋ Mitglied einladen]" is the pattern; Meine Gruppen follows it.

**Verbs are what the member does, not what the system does.** „Weiterschreiben", not „Neuer
Beitrag". „Melden", not „Meldung einreichen". „Gruppe gründen", not „Gruppe erstellen" —
founding a group is a social act.

**When we mail a link, say what to expect of it.** One sentence, the same everywhere
(`MailedLinkNote`): the E-Mail can take a few minutes, look in the spam folder, links only last
a short while. It names the E-Mail rather than „das", which under the deletion notice read as
the deletion taking minutes — and not „Nachricht", which is what a chat message is called. A member who found an empty inbox could not tell a slow delivery from a broken
feature. One note per page, not per message — every state of the verification wall is about the
same link. The validity stays vague on purpose: the lifetime is a backend constant the frontend
cannot read, and a number that drifted from it would be worse than none.

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

**A step shows one person and one time, the ones its state is about**: „angelegt vor 3 Tagen
von annelie" while it is open, „erledigt vor 2 Stunden von mira" once it is done — participle,
time, then who, exactly as a membership reads. Readers
see the list with the controls **disabled rather than hidden** („Nur wer schreibt, kann
Schritte anlegen"): a deliberate exception to hiding what one cannot do, so a reader knows the
group plans here. Completed steps stay under „Erledigt (N)" until someone deletes them.

**A member's own state on somebody else's thing is never shown to its owner.** A story idea
carries „Gelesen" or „Favorit" for the member reading it and nothing for its author: "four
members read your idea" is the statistic the research rejected. Saving something for later is a
private act, and a count of who has done it turns the board into a scoreboard — the same finding
arrived at from the other side.

**A username is permanent, and registration says so.** "Ändern lässt er sich später nicht", in
the field's own description — the one moment the choice can still be made differently. Members
asked for it to work this way: somebody with a bad reputation must not be able to reappear under
a new name, so this is a protection rather than a missing feature, and it is never apologised for
in the copy. Renaming is not planned (#54).

**„Favorit"** everywhere — the word this document used to forbid, and the reversal is the point.
„Merken" was right while the mark existed only on a story idea, where it means noted for later.
The mark now spans groups, threads, posts, ideas and chats, and „gemerkt" says something untrue
about a group you already belong to or a conversation you are in — you are not planning to get to
those. „Favorit" is about what you come back to, which is exactly what the mark now does: it
floats the thing to the top of its list. The old objection stands and is outweighed rather than
answered — an author can still close an idea somebody favourited, and its page and badge survive
that, so the mark never breaks.

**A state toggle is labelled with the state, not the act.** „Gelesen" and „Favorit", and „Nicht
gelesen" and „Kein Favorit" once set — never „Als gelesen markieren" and its undo, which were
wider than most story ideas' own titles on a phone and pushed the one solid action onto a second
row. The long phrasing survives as the button's `title`, which is also where the fact that
clicking it again undoes it belongs. `readToggle()` in `lib/format/storyIdea.ts` and
`favouriteToggle()` in `lib/format/favourite.ts` are the one place either wording lives, and the
two sit side by side on an idea precisely because they are built the same way.

**A favourite floats its thing to the top, except among prose.** Groups, threads, ideas and chats
put favourites first whatever the list is sorted by — that is what the mark is *for*, and a member
in twenty groups should not have to search for the four they open daily. A post does not: a thread
is read in the order it was written, and hoisting a marked passage would put the end of a chapter
above its beginning. What a favourite earns a post is the thread's own „Favoriten" filter, offered
on every list that shows a favouritable kind so the surfaces cannot drift apart.

**The button says the word, the row shows the mark.** „Favorit" and „Kein Favorit" stay words on
a button, because a button names the state it will move the thing *to* — a star there would sit on
the things that are **not** favourites, a few pixels from a star meaning they are, and a mark
cannot point forward and describe the present at once. On a row, where nothing points anywhere,
`Star` is the mark and `BookCheck` is „Gelesen". Both carry `aria-label` **and** `title`, so the
word is a hover away on a desktop and always there for a screen reader; nothing else in the
interface is icon-only, which is why these two are named rather than `aria-hidden`.

**A list row states what it is and what you did with it, as marks.** A list sorted favourites-first
otherwise gives no sign of where they stop, which only looks fine while the filter is on. The
thing's own state comes first and the reader's after it: lock then star on a group, closed then
read then favourite on an idea.

**A mark is one-sided or two-sided, and which one is a decision.** „Favorit", „Gelesen" and
„Geschlossen" are a mark *or nothing* — their absence says nothing worth a chip, and an open idea
is the board's resting state. Visibility is two-sided: a group is always private or public, and
`LockOpen` is there so „öffentlich" is read rather than inferred from a missing lock.

**The lock pair is shipped as an open question, not as a finding.** `Lock` and `LockOpen` differ
only by where the shackle sits, which is a fine distinction at 13px, and visibility is the fact
whose misreading costs the most — a private group taken for a public one is somebody writing to a
room they think is smaller than it is. Three ways round it were tried and are all worse: filling
either lock makes a solid body that stops reading as a lock, and `Globe` for public claims the
internet when „öffentlich" here means the community. So it goes out as the pair and **the thing to
watch for is a member reporting they misjudged who could read a group**; the fix, if it comes, is
the word, which costs 92px and nothing else. Two mitigations are already in place: the group's own
page keeps the word, and that is the screen somebody is on when they are about to write.

**Which words survive: the ones a member is deciding on.** „Von dir" and „Mitglied" stay words,
because the row's marks are facts about the thing while those two say what the reader may *do* with
it — and neither has a glyph anybody would guess. A `User` icon means *a person*, not *you*, and
the Lucide marks that do say authorship all collide with `Pencil`, which already means edit.

And a **page heading keeps the word** where a row takes the mark: „Privat" on the group's own
page, „Offen" or „Geschlossen" on the idea's. That is not an inconsistency, it is how the mark is taught — you meet the word on
the thing's own page and the chip in the list means it from then on.

The mark **is a badge**, with a glyph where the word goes: same border, same 3px radius, same 21px
height, `align-bottom` because a box holding no text has its baseline at its own bottom edge and
sat 2px high without it. A `mark` variant of `CalliopeBadge` owns all of that, so a chip cannot
drift from the chips beside it. It costs 25px against about 60 for the word, which is what lets the
tab strip, the chats rail and the search popover carry it at all — as a word it pushed a chat's
unread count onto a second line and made that row 22px taller than its neighbours.

**Nothing is filled.** A filled `Star` was tried and read as a different weight of thing on a page
where nothing else is filled. Fill was then tried on `Lock` and on `LockOpen`, to tell two
near-identical glyphs apart, and failed in both directions for a different reason: a filled body
stops reading as a lock. Fill is not the tool for separating two marks.

Marks measured against the words they replace: „PRIVAT" 92px and „GESCHLOSSEN" 99px — the two
widest chips in the interface — against 25px each. A search result that is closed and your own
spent 168px of a 414px row on chips before this.

**A thing its owner has ended stays readable, and says so.** A closed story idea keeps its
page and its badge, and the action it can no longer take is **disabled rather than hidden** —
hiding it leaves a member wondering where it went, where a disabled control with a reason
tells them the owner has finished with it.

**A post is edited where it sits, never in the composer.** Its paragraphs become a field in
place, at the same 17px serif they were being read in, so the words do not move when the reader
starts changing them; Speichern and Abbrechen replace Bearbeiten and Löschen in the row the post
already has. The composer is not available for this even though it is the other place prose is
written: it is bound to the member's draft, which the database allows exactly one of per thread,
so borrowing it would put a half-written post at risk in order to fix a typo. Saving is disabled
until something actually changes, so the action cannot claim work it did not do.

**The field it becomes is a raised surface and one hairline** — `--paper-0`, 1px
`--border-default`, the control radius — because without them an edited post is indistinguishable
from the posts above and below it: same ground, no outline, only a toolbar appearing to say anything
happened. It was a plain textarea once, which had that chrome for free.

**Its padding is cancelled by an equal negative margin**, so the field bleeds outward and the prose
does not move by even a pixel when Bearbeiten is clicked. The margin covers the padding *and* the
1px border, which is why both are bracketed values; change one and the other changes with it, or the
words start jumping. The bleed is smaller on a phone (11px against 15px) because the gutter is only
18px there, and a field 3px from the screen edge reads as a mistake.

**An edit says who made it, but only when that is somebody else.** „· bearbeitet" for an author
changing their own post, „· bearbeitet von nachtschreiber" where somebody administering the group
changed a member's. Naming the author beside their own name is noise; naming an administrator is
the entire disclosure, because the alternative is a member finding their words altered with
nothing to say anybody else was there. A post edited by an account since deleted falls back to
plain „· bearbeitet" — there is no longer anybody to name.

**Quoted writing is set as writing, and every text is named where it is said.** In the report
queue the reported content sits behind a `--line-4` rule in the reading serif, and the reason
follows in the interface sans as „X meldet: …" — the two differed by one ink step before, which
is nothing, and an operator who reads them the wrong way round acts on the reporter's words as if
the reported member had written them. Attribution belongs beside each text rather than pooled in
a line beneath both: pooling is what left neither with an owner. The serif runs at the row size
here rather than the reading 17px — this is a three-line quotation in a list, not a reading
surface. The rule is a hairline and never `--oak`, which already means *selected*.

**A confirmation names whose writing it is, when it is not yours.** „Beitrag von X löschen?" and
„Du löschst, was jemand anderes geschrieben hat" where somebody administering a group removes a
member's post; plain „Beitrag löschen?" for your own, and no name where the author's account is
gone, because there is nobody to name. Removing your own paragraph and moderating another
member's are not the same act, and the confirmation is the place that difference registers. The
button stays Solid in both: a single post is one paragraph, which the destructive fill explicitly
excludes.

**A thread is renamed and deleted from its own header.** „Umbenennen" and „Löschen" sit beside
the thread's title, not in the tab strip that lists the threads: the strip is for moving between
them, and a control there would have to appear on hover or hide behind a menu. Both show only for
a member who may modify the thread — its author, or an administrator — and one dialog does both
verbs of a subject, filled from the thread when renaming and empty when creating. The deletion
confirmation names the post count, because „diesen Thread löschen" understates what goes, and the
singular drops the numeral: „sein Beitrag", never „seine 1 Beitrag".

**„Löschen" destroys the thing; „Entfernen" takes it out of something that survives.** A thread,
a story idea and an account are deleted; a member is removed from a group, an invitation is
withdrawn. The words are not interchangeable and the reader is entitled to tell the two apart
before pressing: a story idea's own delete said „Entfernen" for months while doing a real
`DELETE`.

**A member leaves from their own row.** The members list is the one place on a group's page
that is about the reader, and the row that already carries „Entfernen" for everybody else
carries „Gruppe verlassen" for them. The confirmation says what leaving actually costs, which
is not the same sentence every time: ordinarily what you wrote stays and only a fresh
invitation brings you back; as the sole administrator it says nobody will be able to invite,
change a role or edit afterwards; and as the **last member** it is the one irreversible case —
the group and everything written in it go with you, so that variant alone takes the destructive
button.

**A chat is left from its header.** A conversation has no members list, so its two verbs sit
where its other controls do: „Verlassen" beside Einladen and Melden, and „Ablehnen" beside
Beitreten while an invitation is unanswered. Both are one call, as they are for a group, and the
confirmation keeps the group's shape — what you wrote stays, and only the last person out gets
the destructive variant. But *last* counts anybody still deciding: an unanswered invitation is a
membership row, so a conversation outlives the last member who actually joined it.

**A role is edited where it is read.** Each row of the members list carries a select showing
that member's role, saving on change rather than behind a save button — the same shape as the
story status in the rail. The trailing controls sit in one block with the longest action's width
reserved, so the selects line up in a column instead of each being dragged sideways by the
label beside it. A member who gives up their own last administration is warned, not refused:
nothing in the database prevents it, and the reasoning for warning instead is recorded with the
issue.

**A membership shows one date, the one its state is about**: "eingeladen vor 3 Tagen" while an
invitation is pending, "beigetreten vor 2 Tagen" once it has been accepted. Both are participles
and both take the usual relative-then-absolute time. When somebody is in the group, when they
were asked is no longer what a reader wants to know.

**Relative time under a day, absolute above it.** "vor 12 Minuten" → "Dienstag, 09:14" →
"12. Februar". Edits are disclosed quietly, appended: "· bearbeitet".

**An instance that is not production says so, in one sentence.** Development, testing and
staging each carry a notice where there is room to read it — signing in, registering, and the
home page — and a badge beside the wordmark everywhere else. The badge is the whole point of the
split: a phone already stacks three bars, and this must not become a fourth, so inside the
application the sentence lives in the badge's `title`. It says the one thing that changes what
somebody does, never a list of three, and that thing is not the same everywhere: where the
database is reset it is that writing can be deleted, and where it is not — a preview instance,
which keeps what it is given — it is that the member's own groups are not there. A warning that
is untrue of the instance it sits on is how the true ones stop being read. Where the instance
is reachable by strangers, the pages that take a password add a second line telling people not
to reuse one. **Never the destructive fill**: red is reserved for irreversibly destroying
writing, and a red bar on every page of a test instance would spend that signal by the time a
real deletion dialog needs it. Quiet is the right weight — this is chrome, not the member's
content. Production says nothing at all.

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
common and what stays put. Both bars carry the same three destinations — Gruppen, Storyideen,
Mitglieder — and the first two open a **menu of their pages** instead of navigating: Meine
Gruppen / Gruppen entdecken, Meine Storyideen / Storyideen entdecken. Each menu item is the
page's own title. The trigger word costs a click but surfaces discovery, which a heading-line
button alone did not — testers missed it. Mitglieder has one page and stays a plain link. Every
destination shows its icon beside the label in both bars (16px inline on the top bar, 18px
above the label on the bottom), so the two bars read as the same three places. The
menus exist on the phone too, rising above the bottom bar; that is an experiment, revisited if
it reads badly in use.
Anything belonging to one member lives behind their avatar: Mein Profil, Mitteilungen, Chats,
Einstellungen, Abmelden. Mein Profil is the one that navigates rather than opening a dialog,
because the profile is a page strangers read too. That split is also what keeps the bar from growing: two long German
nav words plus the lockup do not fit a 375px phone, and every future personal feature would
have pushed harder.

**„Blockieren" says what it does, and what it does not.** Our block stops contact — no
invitations either way, and the unanswered ones are withdrawn — and deliberately leaves shared
groups, shared conversations and everything written in place. Because the word promises more
than that to most readers, the confirmation spells all three out before the button, and the
profile keeps saying it afterwards ("Du hast X blockiert. Ihr könnt euch nicht einladen."). The
trigger is Plain; the destructive weight belongs on the confirmation, where the consequences
are.

**A story idea becomes a group by copy, not by wizard.** "Gruppe gründen" on one's own idea
opens the ordinary create-group dialog with every field filled from the idea — the author
still chooses visibility and can change anything before confirming. The group dialog carries
the same story fields as the idea dialog, Sprache included, so the copy has nowhere to lose
information. The idea stays open afterwards; closing it is the author's own act.

**„Chat beginnen" is one action with one name.** On a story idea it invites the
author; on a public group's page it invites the administrators. Both are the same gesture — a
person asking people, through a chat invitation the other side must accept — so the label never
varies. It renders as the visitor's one solid button, in the same slot the owner's own controls
occupy: the two never meet.

**„Mitteilungen", not „Benachrichtigungen".** The shorter word is the one German interfaces use
for this (it is Apple's), and it keeps the notifications apart from the Chats beside them.

**One word for the thing: „Chat".** It was three — the dialog said „Nachrichten", its list said
„Unterhaltung", the notification said „Chat" — for one feature, which is three chances to read
them as three features. „Chat" is the word members arrive with, and it was already the one in the
invitation sentence. „Nachricht" keeps its own job: a Chat is the place, a Nachricht is what you
write in it, and the moderation queue names both because it acts on each. The gender goes with
the word — *der* Chat where it was *die* Unterhaltung, so „Verlässt du ihn, wird er gelöscht".

**Personal things open where you are.** Mitteilungen is a dialog, not a page: somebody halfway
through a long post who wants to answer something should not lose the page they are on. Chats
stay a dialog for a stronger version of the same reason — talking about the thread you are
reading is the ordinary case, and a page would take you off it. A dialog is right while the content is a single list; the
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

**A per-post action sits below the writing, not beside the byline.** One recessed row —
`text-[12px]` in `--ink-5`, 14px under the last paragraph — because the byline was already
competing with the prose and the actions would have made it worse. "Melden" is the first one
that works; the rest are specified below and unbuilt. A chat message carries the same row at the
same weight, closer under it because the messages themselves sit closer together.

**The type scale is named, and the name carries the line height.** `text-body`, `text-note`,
`text-nav`, `text-row`, `text-control`, `text-rail`, `text-h1`, `text-h2` — declared once in
`theme.css`, so a size and its leading cannot drift apart. They had: 13.5px was written by hand
in 149 places and had picked up four different line heights for two different jobs. `body` is
page prose in `--ink-4`, `note` the quieter second voice in `--ink-5`, and `nav` the single-line
interface text; those two are additions to `tokens/typography.css`, which was written for the
mockups and has no small-prose size because the mockups had none.

A size still written as `text-[…]` is either a genuine one-off or something the scale has not
caught up with — check before adding another.

**Spacing comes from Tailwind's own scale, which already covers this one.** `1.5` is 6px, `2.5`
is 10px, `3.5` is 14px: the 2px steps in `tokens/spacing.css` are all reachable without writing
a number. Only two things are exceptions. `px-gutter` is the phone gutter — 18px, off the scale,
paired with `md:px-10` in every page frame, and named because twenty-five sites wrote it out.
And a value in brackets, `pb-[11px]`, means *deliberately off the scale* — usually an optical
alignment like the tab baseline. That is what the bracket is for, so do not "tidy" one into a
fractional step: `pb-2.75` would make an exception look like a rule.

**A control that does nothing does not ship.** The post actions were disabled buttons under
every post for a while, and a reader learns from that to stop looking rather than to wait. The
copy below stays specified — it is what the buttons will say when they work (#36, #37, #38) —
but nothing renders it until it does something.

**Copy examples to reuse verbatim:** Weiterschreiben · Beitrag senden · Vorschau · Antworten ·
Zitieren · Favorit · Kein Favorit · Melden · Anmerkung schreiben · Mitglied einladen · Gruppe gründen · Thread ·
Schritt · Alle Beiträge · Nächste Schritte · Story-Status · Dateien & Bilder · Suche ·
Editor einklappen · Editor ausklappen · Gruppen-Kontext · Gruppe bearbeiten ·
Änderungen speichern · Entfernen · Einladung zurückziehen.

**„Meine Gruppen" means the ones you belong to.** Being allowed to read a public group is not
belonging to it, and a list that mixes the two answers neither question — a member seeing three
entries could not tell which were theirs. So Meine Gruppen shows joined groups only, public ones
the member is not in live under **Gruppen entdecken**, and pending invitations are a section above
the heading. Three lists, one question each.

**An invitation is answered where it is found.** It carries Beitreten and Ablehnen both in that
section and on the group's own page, because deciding about three invitations should not be three
visits, and because the notification leads to the group rather than to the list. Declining is the
same act as leaving — both end with no membership — and returns the member to Meine Gruppen, since
a declined private group stops being readable. 

**Discovery states what it does not offer.** A public group can be read by anyone but joined only
by invitation, so the page says so in words — "Mitlesen kannst du sofort; mitschreiben, sobald
dich jemand einlädt." A "Beitreten" button that would fail is worse than no button. The row
itself carries no button at all: its title is the link, and "Gruppe ansehen" only repeated what
the title already did while making the two group lists look different from each other.

**A group row is the title and what it is.** Title, subtitle, synopsis, last activity — and no
action button: the title is the link. The synopsis is **clamped to three lines**, as a story
idea's teaser is: it may run to eight thousand characters, and one long one would push every row
after it off the page. Its own page shows the whole thing. `GroupRow` renders the same on Meine Gruppen and on
Gruppen entdecken, and an invitation adds its answer buttons because there the row *is* a
question.

**A story-idea row is what the group row is, plus what the story is.** Title, the short version
of the idea, then the metadata on one line — genres, subgenres, tropes, then the narrative style,
which is narrowing order, because somebody scanning a board is choosing a kind of story before
they care what tense it is in. Fields nobody filled in are left out rather than labelled, so a
sparse idea reads as short rather than unfinished.

**Content warnings get their own line, and the word.** "Inhaltswarnungen: …" under the rest,
never mixed into the tag line: a reader looks for them before deciding to read, which is not what
a genre is for.

**An idea is written twice, and both are required.** The short version stands alone on a board;
the long one is on the idea's own page, *under* the short one, because members write the short one
as the opening of the long one rather than a summary of it — so the page reads as one text. That
is the only place in the product where two prose fields are both mandatory, and the reason is that
a card which borrows the first three lines of a long text cuts them mid-sentence.

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
in none of the mockups. The single exception is `--destructive` as a button fill, for the few acts
that destroy writing irreversibly — see Buttons.

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

**A page title starts where every other page's does.** The scroll container's own `py-5` is the
whole gap between the top bar and the 25px heading — no page adds a top margin of its own. Two
pages carried a stray `mt-3` and sat 32px down instead of 20px, which reads as a wobble when
moving between them. Where an action shares the heading line, `items-baseline` against a 44px
button pushes the title down a few pixels on a narrow screen; the *row* still starts at 20px.

**Backgrounds.** Flat colour only. No images, no gradients, no textures, no patterns, no
illustrations. The one exception is the diagonal hatch placeholder used for image thumbnails that
have no asset yet.

**Borders and dividers.** 1px hairlines carry all structure. Posts are separated by a full-width
`--border-divider` rule with `--post-gap` (26px) above and below — boxed posts were rejected in
round 1, but round 2 showed posts need *some* separation. 2px marks a current position — the
active tab underline, the active item in the bottom bar — and the vertical rule of a notes/quote
block.

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

**Buttons.** Three levels for everything the product asks of a member. *Solid* —
`--action-solid-bg` fill, `--text-on-solid`, 6px radius, for the one primary act of a screen
("Beitrag senden"). *Quiet* — `--surface-quiet` fill, 1px `--border-strong`, `--accent-deep`
text, 500 weight ("Mitglied einladen", "＋ Schritt", "＋ Gruppe", "Vorschau"); this level was
strengthened after feedback that the invite button was too easy to miss. The same finding once
moved "Gruppen entdecken" from the foot of Meine Gruppen onto its heading line; the nav menu
now carries it on every page, and the heading-line copy went with the duplication. *Plain* —
text only in `--ink-5`, for per-post actions.

**Which level an act gets is decided by its subject, never by the page it was built on.**
Solid completes a form or a dialog, one per screen. Quiet is an action on the object the screen
is *about*, or on a section, sitting in a header or a heading line. Plain is an action on one row
of a list, where five borders would tile the page. One question settles it: is the subject the
whole screen, or one row of it? Without that test the treatment tracked whoever wrote the page —
the block toggle was Quiet in its one branch and Plain in the other, and a single story-idea
header carried four different levels side by side.

That header did it again the day it grew a fourth button: „Favorit" Plain, „Gelesen" Quiet,
„Melden" Plain, „Chat beginnen" Solid — alternating, and every one of them an act on the idea the
page is about. **The test would have caught it, so what changed is that the test is now hard to
skip**: `FavouriteToggle` no longer takes a level, because it only ever sits on a thing's own page,
and its prop had been set to Plain at all three call sites. A control that appears at one altitude
should not offer a level at all.

„Melden" is Quiet for the same reason, on every page that carries it. Reporting *should* recede,
and **placement** is what does that — it sits last, after the ordinary actions — not a quieter
level. A level says what an act is on; how often anybody wants it is a matter of where it goes.

**One implementation per level, and it lives in the Button component.** Quiet is
`variant="outline"`, carrying the fill *and* the border; there is no second bordered variant,
because `secondary` existed as Quiet with its border missing and drifted into the same jobs.
Anything hand-rolled states the level exactly — „＋ Schritt" in the rail is the same six
declarations as the component, checked against it rather than eyeballed. The one deliberate
departure is „＋ Thread" in the tab strip, which shares a baseline with the tabs: a bordered box
there breaks the strip, so it is Plain and its neighbours are what make it findable.

*Destructive* is a fourth level and the only place `--destructive` `#8a3f37` appears as a fill.
It is reserved for acts that **destroy a body of writing, including other people's, and cannot be
undone by repeating them**. Three qualify: the account-deletion flow ("Löschen-Link anfordern"
where it is asked for, "Konto endgültig löschen" where it happens), deleting a thread with its
posts, and leaving a group as its last member, which takes the group with it. Not for removing a
member, withdrawing an invitation, leaving a group that outlives you, or deleting a single post:
those are ordinary administration, they are reversible by doing them again or they cost one
paragraph, and colouring them red would spend the one signal the product has. And never on the
trigger — the weight goes on the confirmation, where the consequences are stated. Reserve it, or
it stops meaning anything.

**States.** Hover darkens by one step (solid → `--accent-deeper`; quiet → `--paper-4`; plain →
`--accent-deep`); never a lift, and never a *hue* change — `--accent-deep` is one degree of hue
from `--ink-5` and thirteen points of lightness below it, so on plain text it reads as darkening
rather than as a second colour. Plain hover changes the text and nothing else: giving it a
`--surface-quiet` background would turn a Plain control into a Quiet one under the pointer, same
fill and same text, only the border missing.

**A control with a selected state darkens to `--ink-1` instead.** Tabs, the filter strips and the
top bar's destinations all mark selection with an accent underline, so a hover that moved toward
accent would read as selected. They are the one exception to the line above, and the reason is
the selection rather than the control: anything that can look chosen keeps its hover in ink. Press is a further step
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

**The story-idea carousel is the one exception**, and a deliberate one: moving between ideas
slides horizontally, because the movement is what tells the reader they have gone somewhere and
in which direction. It is the only slide in the product, and it is the house 220ms and `--ease`
like everything else — a transform on a track, behind `motion-safe:`, so somebody who asked for
less motion gets none. A second sliding surface needs a reason of its own, not this precedent.

**Selection is a rule, never a box.** A 2px rule in `--oak` marks the current tab, the current
bottom-bar item and the chosen option in a filter strip (`FilterStrip`); the inactive ones keep
a lighter rule so they read as the same kind of thing. A filter is never the solid button
level — that is the one primary act of a screen, and filled chips both out-shout it and read as
separate things rather than one control. The rule ends with the last option rather than running
to the column edge, which was tried and dropped. Raised paper with a hairline and a radius was tried and dropped: it read as a card rather
than a position, and left the other items with no affordance at all. Hover darkens the text and
the rule, never fills — a hovered item would otherwise look more selected than the selected one.

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

**Mobile.** Single column, `--thread-gutter-mobile` 18px. The top bar keeps the wordmark,
search and the avatar; primary navigation moves to a bottom bar. That bar carries **Gruppen and
Mitglieder** today — the mockup's Forum and Partner are unbuilt features, and a slot for
something that does not exist is worse than a shorter bar. The active item takes the 2px
`--accent` rule on its top edge, mirroring the top bar's underline.

Threads stay tabs — a horizontally scrolling strip under the group title, never a dropdown. The
composer is a one-line bar that expands on focus, collapsed by default. Prose stays 17px — never
shrink the reading size. Every target is at least 44px (`--tap-min`).

**The formatting toolbar is text, not a row of icons.** It sits *below* the writing, in the
footer the inert placeholder already occupied, and its controls are short labels styled to show
what they do — a bold **B**, an italic *I*, an underlined U, a struck-through S, `H2` and `H3`,
Liste, 1. Liste, „“, Code in mono, Link. That follows the rule that an icon accompanies a label
rather than replacing it, and it is what the placeholder was always going to become.

**The composer's toolbar is three menus** — Absatz, Zeichen, Einfügen — and nothing else. Twenty-one
controls do not fit one strip, and a menu affords the whole German word, so the strip's `B`/`I`
abbreviations and the icon-only alignment exception both went with the regrouping. There is now no
control in the toolbar itself that carries an icon in place of a label; the bubble below is the one
exception. Any further one needs that argument made out loud, or it is a row of icons by drift.

**A selection shows a bubble**: the four character marks as icons over the selected text, placed
*below* it because a phone puts its own selection menu above, and never closer to the screen edge
than the gutter. **It is the one place an icon replaces a label rather than accompanying it**, and
the argument is the one the alignment row used to make: the surface floats over the prose it is
about, so it has to stay small enough not to cover it. Each icon carries the German word as its
accessible name. Everywhere else — the three menus included — an icon sits *in front of* its label,
which is what ties a bubble action to its menu entry.

It is a hairline on `--paper-0`, not a floating card: nothing at rest casts a shadow, and a bubble is
at rest whenever it is visible. It is the fast path and never the complete one — a mark can also be
set on a collapsed cursor, which no bubble can serve, so the Zeichen menu holds everything the
bubble does. Which four are in it is a judgement about what people reach for, not a category:
`Code` is deliberately out.

An active control is `--paper-0` with a 1px `--border-default`, the same treatment an active rail
row gets; an inactive one is borderless and `--ink-5`. **The row scrolls sideways in its own
container** rather than wrapping or hiding below `sm` — formatting has to be reachable on a phone,
and a second row would push the writing off a short screen. Every control is 44px on a phone.

**The composer's prose is 17px**, like everything else a member reads. It was 16.5px while it was
a textarea, which was the reading size quietly shrinking by half a pixel; the editor renders at
`prose-post`, so what is being written now matches what it will look like.

„Vorschau" is **gone** rather than disabled: a WYSIWYG editor previews itself, and a control that
does nothing does not ship. The copy stays specified above for whenever it means something again.

**Both rails hold group context, split by what a member does with it.** The left rail is
reference: the story's own facts, its files, who is in it — what a member checks while writing.
The right rail is action: the next steps, and the story's status with the control that changes
it. Neither appears on the groups overview, which has no group to be about.

**Every block in both rails is closed until asked for.** Each is a disclosure — `ChevronRight`
shut, `ChevronDown` open — and none opens by default, because everything visible at once was
reported as distracting. Several may be open together; the choice is not remembered between
visits, since a rail is material a member reaches for rather than a workspace to arrange. And
the mobile sheet stacks everything open — a sheet opened on purpose is not what was distracting
anybody.

The right rail was the exception until members asked for the accordion there too. It had been
left alone on the reasoning that what a member *does* should not need a click, and the one thing
that reasoning was right about is kept: a closed block may carry a **count** beside its label —
„Nächste Schritte  3 offen" — so the rail still says there is something to do without being
opened. It is the only thing a closed block shows, and only where there is a number worth
reading; the reference blocks have none.

Neither rail navigates. The group list moved to the overview page, because the daily loop starts
there — members described scanning every group for new replies before answering any, and a rail
of bare titles cannot say which one changed where the overview, sorted by last activity, can.
Every group page carries "‹ Meine Gruppen" back to it.

On a phone the two become **one** sheet, opened from a strip above the content, action first and
reference below: one button rather than two competing strips. The cost is that the order differs
by width — reference sits left of the text on a desktop and below the actions on a phone.

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
| `×` | `X` | delete a step (plain, never red — a step is re-creatable in seconds) |
| `⌕` | `Search` | search |
| `⠿` | `GripVertical` | drag handle (only if drag-reorder ships) |
| — | `Bold` `Italic` `Underline` `Strikethrough` | the four character marks, in the Zeichen menu and alone in the bubble |
| — | `Code` | inline code (Zeichen menu only, never the bubble) |
| — | `Heading2` `Heading3` | Überschrift and Zwischenüberschrift |
| — | `List` `ListOrdered` | Liste and Nummerierte Liste |
| — | `Quote` | Zitat |
| — | `AlignLeft` `AlignCenter` `AlignRight` `AlignJustify` | the four alignments, now labelled words in a menu |
| — | `Link` | insert or edit a link |
| — | `Minus` | Trennlinie, which is what a horizontal rule looks like |
| — | `RemoveFormatting` | Formatierung entfernen |
| — | `Pencil` | edit an existing thing ("Gruppe bearbeiten", "Umbenennen") |
| — | `Trash2` | delete a thing for good ("Löschen") |
| — | `MessageCircle` | start a chat ("Chat beginnen") |
| — | `Star` | a row's „Favorit" mark — never on the toggle, which keeps its word |
| — | `BookCheck` | a row's „Gelesen" mark. Closed, not `BookOpenCheck`: an open book reads as *being* read, and its page curves plus the check are dense at 13px |
| — | `Lock` `LockOpen` | a row's „Privat" / „Öffentlich" mark, both always shown — see the open question above |
| — | `CircleCheckBig` | a row's „Geschlossen" mark for a story idea. **Not** a lock: a closed idea keeps its page and every word of it, so a lock would say you cannot get in when you can — the author has only stopped looking |

Every icon states `stroke-width="1.5"`; Lucide's own default is 2, which is heavier than
anything else on the page. Size them to the text they sit beside — 14px against 12.5–13.5px
interface text — and let them inherit `currentColor` rather than carrying a colour. Inside a
button the component does that sizing; a call site passing its own `size` is overriding a
decision that belongs in one place.

**Words still come first.** An icon accompanies a label, it does not replace one: the buttons
read "Gruppe gründen" and "Thread", with the mark in front. The exception is movement that has
nothing to name — the rail's collapse chevron, the tab strip's scroll arrows, the carousel's two —
which carry an `aria-label` instead. No *act* is ever icon-only.

**One act, one mark, wherever it appears.** `Plus` adds, `Pencil` edits, `Trash2` deletes for
good, so a member who has learned one has learned it for every object. `BookCheck` beside
`SquareCheck` is not the exception it looks like: a check means *done* in both, and the noun in
front of it says done with what — a step, or a reading. Two things take no mark on
purpose: „Entfernen", because removing somebody from a group that survives is a different act
from destroying a thing, and a dialog's confirm button, whose title has already named the act.
Import each icon under one name — a `PencilIcon` beside a `Pencil` is one file twice and reads as
two decisions.

Unchanged: file types stay mono text (`PNG` `MD` `JPG`), never a file icon. Avatars are
**a member's own photograph where they have set one, and their initial otherwise** — initials in
`--text-avatar` on `--surface-avatar`, never a *generated* image. The initial is also the fallback
when a picture fails to load, so a missing file degrades to a letter rather than a broken frame.
A picture appears everywhere an initial does, at every size, because a partial rollout leaves a
member unable to tell where their picture counts. **Never animated**: motion is almost none by
policy, and the upload flattens an animated file rather than storing one. **No emoji** — the round-1 emoji
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
