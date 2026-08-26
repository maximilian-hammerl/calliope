# Implementation Status

How the built product compares with `product-requirements-feature-specification.md`,
`yooco-research-report.md`, `interviews.md` and the design system.

Updated 21 August 2026. The first half says what is there; the roadmap at the end says what to
do next, and in what order.

**<https://calliope.hammerl.dev> is a testing environment, not production.** It is wiped when a
migration calls for it — twice on 20 August 2026 alone, last for the `story_language` enum
that groups and story ideas share. Blocking added a table rather than changing one, so it
needs no wipe. Everyone with an account there is a beta tester who knows
this. Nothing on it should be treated as durable, and nothing about it should be read as a
production deployment.

## Where the project stands

The defining feature is built, and so is the account layer around it. A member can register,
confirm their address, sign in, recover a forgotten password, change their address or password,
create a private or public writing group, invite people, manage their roles, open threads and
write posts in them — the promise in §45, *"Create a private writing group. Write together."*

Since the last snapshot the account became a whole: a member can **delete it** (password, then
a mailed link), and every member has a **profile page** with a **member overview** to find it
from — thin ones, name and joined date, but search and member lists finally lead somewhere.
The product now **works on a phone**: a bottom bar navigates, the two rails merge into one
sheet, the composer starts collapsed, and every target on every page is at least 44px. And
**The group's shared checklist is real** ("Nächste Schritte"), in the rail — Yooco had one so
hidden that two of three interviewees never found it — where writers add steps inline and tick
them off, recording who completed what.

Newest of all, the first stranger-facing surface: **Storyideen** (§8's partner search,
reframed as an idea seeking writers), with a board that hides what is settled and never shows
the reader their own ideas, a detail page, and a Meine-Storyideen view. With three top-level
destinations the navigation was rebuilt around **menus in both bars** — Gruppen and Storyideen
each open their two pages, Mitglieder stays a link, and every destination carries its icon.

One mark now runs through the whole product: **Favoriten** (#73) on a group, a thread, a post, a
story idea or a chat, private to the member who set it, floating what they marked to the top of
every list that holds it — and deliberately not doing so among the posts of a thread, which is
prose and reads in the order it was written. That subsumed the older per-kind bookmark (#37),
which is why the word changed: „Merken" was right for a story idea alone and says nothing true
about a group you are already in.

Strangers can also now be refused: **blocking** stops contact in both directions, withdraws the
invitations still open between the two, and takes the other member out of lists, search, the
ideas board and notifications — while leaving shared groups, shared conversations and
everything written alone. That was the gap between the board and announcing it to testers.

What is still missing is most of what makes a **community** rather than a set of groups: no
public forum, no files and no data export. Reporting now reaches somebody: a member can report
any of seven kinds of thing, and an operator works the queue at `/moderation`. The product is usable by
people who already know each other; for strangers it now opens a first door with a lock on
the inside, but still no caretaker.

## Against the MVP scope (§42)

| Area             | State                                                                                                                                                                     |
|------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Accounts         | Registration, address verification, login, sessions, password reset, password change, address change, account deletion. A profile answers how somebody writes (#29): seven optional free-text fields, readable by every member and by nobody without an account. |
| Writing groups   | Member-created, private/public, invitations with acceptance, roles, group discussions, next steps. **No** files, **no** way for a member to leave (#26) and **no** way to change a role once given (#27). |
| Favourites       | One mechanism over groups, threads, posts, story ideas and chats (#73): a private mark that floats the thing to the top of its list — except among posts, where a thread keeps its reading order and the mark drives the filter instead. Every list that shows a favouritable kind offers the filter. |
| Communication    | Group chat with live updates, in-app notifications, transactional email. Starting a conversation ("Unterhaltung beginnen") opens one from an idea or a public group; blocking refuses one. **No** open "message this member". |
| Public forum     | Not started.                                                                                                                                                              |
| Writing partners | Built as **Storyideen**: board, detail page, a carousel that walks the unread ideas, statuses, starting a conversation with the author ("Unterhaltung beginnen"), and founding a group from one's own idea ("Gruppe gründen"). |
| Administration   | Partly built: platform roles (moderator, administrator), reporting of all seven target kinds, the operators' queue at `/moderation` with its lifecycle and an audit trail, and banning an account. **No** removing reported content (#62), operator view of a member (#46) or of a group (#47), and no settings screen. |
| Privacy          | Account deletion is built; writing survives with the author nulled, empty groups go with the account. Blocking refuses contact. **No** data export, no GDPR configuration.  |

Two Phase 2 items (§43) arrived early because they were cheap alongside the group work: group
chat, and read-only group roles.

## Email, which was the last snapshot's biggest gap, is done

All of §17's *required* list is now met except **session revocation**, which is one bullet in
that list and nothing more — no interview mentions it and the design system does not describe
it. What it should look like is therefore open; see the roadmap.
Verification gates the account behind a wall that still allows signing in, so a mistyped address
can be corrected rather than orphaning the account. Reset, verification and address change all
run on one `user_token` table with a purpose enum and one-hour links.

Mail relays through an external SMTP account rather than the VPS. SPF, DKIM and DMARC pass, and
the German templates score 10/10 on content. Two gaps remain and are recorded in
`deployment/README.md`: **bounces are read by a person**, and **mail in flight is lost on
restart**.

## Deliberate departures

These are decisions, not omissions, and each is recorded where it was made:

- **Notifications are narrower than §38.** Only things addressed to a person. "Followed topic
  activity" and a per-message chat notification were left out on purpose: the research is
  emphatic that the old platform's stats made members anxious, and a feed of everything you are
  missing is that same mechanic.
- **Chat has no notifications of its own.** Its unread count is the mechanism.
- **Steps tell nobody and move nothing.** Ticking a step produces no notification (it is not
  addressed to a person) and does not touch `last_activity_at` — planning is not writing, and
  the group list must not reorder because somebody ticked a box.
- **You cannot message a member who has not agreed to hear from you.** Chats are titled and
  invite-based, and a group works the same way: an invitation has to be accepted before anyone
  can write to you. This is deliberate — it means one member cannot simply start sending
  another messages. The residual is invitation spam, which is the smallest version of the
  problem, and **blocking now closes it**: neither side can invite the other, and the
  invitations already outstanding are withdrawn.
- **Search covers groups, threads and members, not posts.** Post search needs snippet
  extraction and an index before it is honest.
- **The composer is plain text.** Blank lines become paragraphs and nothing else is marked up.
  Formatting is #44, where whether a member ever works in markup directly is still open.
- **A 401 means "no session" unless a mutation is on a list.** `EXPECTED_401_MUTATIONS` in
  `lib/api/queryClient.ts` names the operations whose 401 is an *answer* — signing in, and the
  three that re-authenticate with the current password. Anything not on it is treated as a
  lost session. The list being a denylist-by-omission is the real issue and is unresolved:
  every future re-authenticating endpoint has to remember to join it (`changePassword` once
  forgot, and the symptom hid well).
- **Both bars hold three destinations, not the mockup's four items.** Gruppen and Storyideen
  open menus of their two pages each (discovery surfaced this way because testers missed the
  heading-line button); Mitglieder is a plain link. Forum remains a roadmap item, and a slot
  for something that does not exist is worse than a shorter bar. Menus on the phone are an
  experiment, revisited if they read badly in use.
- **The rails are cut by purpose, not by side.** Left is reference (the story's facts, files,
  members), right is action (next steps, status with its switcher); navigation moved to the
  overview and the bottom bar, and on a phone both rails are one sheet. The design system
  carries the full reasoning.
- **No undo after an address change completes.** The window is the hour before, during which the
  old address can cancel. A real undo needs a longer-lived token and a policy for what
  reverting means.
- **Profile fields carry no visibility setting (§10, §18).** §10 asks for four levels and calls
  for granular privacy; §18 lists "configurable profile visibility" among its required items.
  Neither is built, deliberately. Nothing here is readable without an account — every endpoint
  but `health` and the auth flows carries `authenticated` — and the fields exist to be read by a
  stranger who has not written with you yet, which is the one audience a group-scoped level hides
  them from. Every field is optional, so what a member does not want read is a field they leave
  empty, and a setting on an optional field is a second lever for the same thing. A sentence
  beside the fields, saying who can read them, is what replaces it. §10's fourth level,
  "everyone", would be a new capability rather than a restriction lifted: §23 separates
  community-visible from published and nothing is published yet — and if that step is ever built,
  profile fields stay behind the account wall.

## Specified but unbuilt in the interface

- **The files block** in the rail ("Dateien & Bilder") is a static mockup with invented
  content. The story status and the next-steps checklist are real — steps are added inline, ticked off recording who completed them,
  and completed ones keep forever under a done-items disclosure ("Erledigt (N)") unless
  deleted by hand.
- A post carries **one** action of its own: favouriting, which arrived with #73 and closed #37
  along the way. **Quoting (#36)** and **annotations (#38)** are still specified in the design
  system's copy and not built, and the disabled buttons that stood in for them are gone: a control
  that has never worked teaches a reader to stop looking. The thread's **post filter** ("Alle
  Beiträge") is back, with the one of its two real options that now exists — „Favoriten" — and
  „Mit Anmerkungen" joins it with #38. The design-system prototype keeps the specification for the
  rest, including the finding that the filter is one menu rather than a row of chips.

## Correctly absent

Nothing has been built from §41's list of things not to prioritise — no gifts, flirt system,
image voting or gamification. Members did not ask for any of them.

---

# Roadmap

Ordered by what blocks what and by what the research says members came for, not by size. The
first is a day's work; items 6 to 8 are the bulk of the remaining MVP.

### 1. A group can lose its last administrator

Nothing stops the last administrator being removed, leaving, or deleting their account, which
leaves a group nobody can administer. Small, understood, and it gets worse with every group
created — a trigger beside the one that removes an empty group closes all three paths at once.

### 2. Profile fields — built

A profile now answers whether somebody would suit you to write with (#29), not only who they
are. Seven fields on `user`, every one optional, every one free text and every one about writing:
Über mich, Bevorzugte Schreibweise, Bevorzugte Beitragslänge, Bevorzugte Schreibhäufigkeit,
Erwartungen an Mitschreibende, NO-GOs beim Schreiben, Lieblingsgenres. Edited from the member's
own page, which is also where they are read and which shows only what was answered.

**Preferences rather than measurements**, which is how Yooco words its own („Bevorzugte
Schreibweise"): what somebody wants is what decides whether two people suit each other. An age or
a form of address is deliberately *not* a field — `about_me` accommodates anybody who wants to say
it, while a column would ask the question of everyone, which is what §18 warns against.

**The list is not §10's, and that is the finding.** §12 and §17, the two interview sections that
asked directly, are unanswered; §4.4 to §4.8 answer it sideways and more usefully, naming
**writing style, post length and writing frequency** both as what members look for and as what
ends a collaboration — none of which §10 lists. Three exported Rollenspielhimmel profiles fill
exactly those, plus expectations, NO-GOs and genres, on all three, and „Über mich" on two.

Prose rather than the story metadata's controlled values, because a profile is *read* about one
person rather than filtered — 29 to 244 characters on those profiles, no two members alike. Three
constraints held: **no statistics, ever**; **nothing mandatory**; and **no visibility setting**,
recorded above.

What is left is an avatar, which §10 lists and nothing here supplies.

### 3. Story ideas — built, follow-ups included

§8's partner requests, reframed as **Storyideen**: an idea seeking writers, because that is
what members valued about the original ("Gesuche mit schon einer konkreten Idee"). Live: the
board (open ideas by default, the reader's own excluded — it is discovery, like public
groups), the detail page, posting, editing, an open/closed status (§8.3's intermediate states
were dropped — bookkeeping nobody would maintain), a language enum shared with groups, and a
Meine-Storyideen view. The seeking metadata deliberately started small — the party size ("Konstellation") stayed;
length, writing rhythm, writing style and availability were cut until someone misses them. The
story block mirrors `writing_group` column for column so an idea can one day become a group by
copying.

**Starting a conversation is built** ("Unterhaltung beginnen"), on ideas and beyond them: on an idea it creates a chat
titled after it and invites the author — §11's "public idea → private conversation", assembled
from parts that already existed — and on a public group's page it invites every joined
administrator, which is how a stranger asks into a group without any join-request machinery.
**Founding a group from one's own idea is built too** ("Gruppe gründen") — the create-group dialog opens prefilled
field for field (the idea's synopsis becomes the group's, under the same name), which is what the
matching columns were kept in step for. The author still chooses visibility and confirms; the idea stays open until
they close it, deliberately — a fresh group of two might still want a third writer. With that,
§8 is done. Item 4 below stops being optional the moment testers get this board.

**An idea is written twice** (issue #9): a required short version, which is what the two boards
show, and a required long one on the idea's own page underneath it — a card that borrowed the
first lines of one long text cut them mid-sentence, and nobody got to write a summary they meant.
The rows now also carry the story metadata the dialog collects, with content warnings on a line
of their own. `writing_group.blurb` became `synopsis` in the same change, so an idea and the group
it becomes name their long text the same way.

**A carousel view** (issue #20) reads the board one idea at a time, with the depth of the detail
page and two buttons to move between them. Its set is fixed rather than inherited — open,
unread, not your own, newest first — which is why the route carries only the idea and no filters.
It walks by **id, not by position**: `QUERY /story-ideas/carousel` answers with an idea and the two
either side of it, so somebody posting an idea while you read cannot shift you sideways, the way an
offset would. A step replaces the URL rather than pushing it, so the back button leaves the
carousel instead of retracing every idea seen. It sits in the Storyideen menu beside the two
board views, and it is the one place in the product where something slides — two buttons and a
transform, no carousel library: swipe and keyboard can follow if anybody asks for them.

### 4. Block a member — built

Blocking refuses contact in both directions across all four surfaces that can carry an approach
(both invitation routes, both conversation routes), withdraws the invitations still unanswered,
and hides the other member from lists, search, the ideas board and notifications. Nothing shared
is removed: a group or conversation you are both in stays until one of you leaves, and writing
stays regardless.

Note what this is *not*: **reporting**, §11's other half, needs somewhere to land and so waits
for item 8. And nothing stops a member already in a shared chat from writing in it — leaving is
the answer there, which is the one place this feature deliberately stops short. Section 16 of the
interviews, the whole of *Sicherheit und Moderation*, was never answered, so this was kept
mechanical rather than inventing policy nobody asked for.

### 5. Personal data export (§18, §42)

Deletion is built; export is what is left of §18's pair. Worth doing before files and the
forum, for the reason deletion was: every feature added first makes it a larger surface to
walk. Note for item 1: deleting an account is a third way for a group to lose its last
administrator — the trigger there closes all three paths.

### 6. Files in writing groups

The last item in §42's writing-group list, and the one the rail already pretends to have.
Needs storage, a size policy, and a decision about what leaves the server when an account is
deleted — the one part of that flow a foreign key cannot answer on its own.

### 7. Public forum, with moderation (§9, §15, §16)

The largest remaining block: categories, topics, replies, search, attachments. Moderation and
reporting belong in the same change rather than after it — a public space without them is one
that cannot be run.

### 8. Administration (§42)

Roles, reporting, the queue and bans are built. What is left is the acting: **removing reported
content** (#62) is the hole an operator meets most, since every content delete is gated on
`mayModify` and no operator path exists; then an operator's view of a member (#46) and of a group
(#47), transferring a group's administration (#49), and a settings screen. Needed in full once
strangers reach each other at scale, which is to say once 7 exists.

**The queue's lifecycle** is a report moving `open → in_progress → closed`, and a closing is final:
there is no reopening. What that buys is that the lifecycle only goes forward, so the report itself
is the record §16 asks for — who has it, when they took it, when they closed it, with what outcome
and a mandatory note — rather than a log table beside it. `status` is a generated column over the
two timestamps, so it cannot disagree with them. Taking a report somebody already holds hands it
over, because a claim nobody could take over would strand a report the day its holder stopped
reading the queue; closing it is reserved to whoever holds it. The outcome enum is what `resolved`
and `dismissed` used to say between them, and says it finely enough to be worth reading a second
time.

**No undo for a mis-closing** is the accepted cost. The friction of an outcome and a written note
makes one unlikely, and a closed report no longer blocks the same member reporting the thing again,
so a live problem returns to the queue on its own. Adding reopening later is additive.

### Session revocation, unplaced

§17 lists it as required and says nothing else, and no interview raises it. What it should be
is genuinely open:

- a **"sign out everywhere"** button, which is one endpoint and one line of copy, and which the
  password change already does implicitly;
- the same plus a **count** of other active sessions;
- a **list** of sessions with device, location and last use, each individually revocable.

The list is the version people recognise from other products and the only one that answers "is
someone else in my account". It is also the only one that needs new columns — a user agent and
a last-seen timestamp on `user_session` — so it should be decided before that table is next
touched, not after.

## Smaller things, unscheduled

Worth doing when they are convenient, none blocking:

- **Registration reveals whether an address is in use** through its 409. Weak — the message
  does not say which of the two collided — but real. Closing it means making registration
  non-committal, which is its own feature.
- **A mail outbox**, if mail lost on restart ever matters. Writing the intent in the same
  transaction as the token is the only design where a token cannot exist unannounced.
- **Bounce handling.** Reading the sending mailbox over IMAP would replace the manual check.
- **Post search**, once an index and snippet extraction are worth it.
- **The frontend's oxlint config**, which has not had the pass `backend/` and `database/`
  got. Its `compilerOptions` now match theirs, which was the half that mattered: oxlint
  cannot report an unused binding inside `<script setup>` — top-level bindings are exposed
  to the template and it does not read the template, so the rule would flag everything used
  only in markup. `vue-tsc` builds a render function from the template, so it can.
