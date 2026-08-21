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
**Nächste Schritte is real**: the group's shared checklist in the rail — Yooco had one so
hidden that two of three interviewees never found it — where writers add steps inline and tick
them off, recording who completed what.

Newest of all, the first stranger-facing surface: **Storyideen** (§8's partner search,
reframed as an idea seeking writers), with a board that hides what is settled and never shows
the reader their own ideas, a detail page, and a Meine-Storyideen view. With three top-level
destinations the navigation was rebuilt around **menus in both bars** — Gruppen and Storyideen
each open their two pages, Mitglieder stays a link, and every destination carries its icon.

Strangers can also now be refused: **blocking** stops contact in both directions, withdraws the
invitations still open between the two, and takes the other member out of lists, search, the
ideas board and notifications — while leaving shared groups, shared conversations and
everything written alone. That was the gap between the board and announcing it to testers.

What is still missing is most of what makes a **community** rather than a set of groups: no
public forum, no administration, no files, no data export, and **no reporting** — a blocked
member is handled privately, but nothing yet reaches a moderator. The product is usable by
people who already know each other; for strangers it now opens a first door with a lock on
the inside, but still no caretaker.

## Against the MVP scope (§42)

| Area             | State                                                                                                                                                                     |
|------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Accounts         | Registration, address verification, login, sessions, password reset, password change, address change, account deletion. Profile exists but is thin: name and joined date. |
| Writing groups   | Complete: member-created, private/public, invitations with acceptance, roles, membership management, leaving, group discussions, next steps. **No** files.                |
| Communication    | Group chat with live updates, in-app notifications, transactional email. "Unterhaltung beginnen" opens one from an idea or a public group; blocking refuses one. **No** open "message this member". |
| Public forum     | Not started.                                                                                                                                                              |
| Writing partners | Built as **Storyideen**: board, detail page, a carousel that walks the unread ideas, statuses, "Unterhaltung beginnen" (a chat inviting the author), and "Gruppe gründen" from one's own idea. |
| Administration   | Not started. Blocking is built, but moderation, reports and a queue are not — see the roadmap.                                                                            |
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
- **Rich text is not merged.** A Tiptap editor sits on the `text-editor` branch because a
  requirement for a raw-HTML toggle arrived after it was built and has not been resolved.
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

## Specified but unbuilt in the interface

- **Dateien & Bilder** in the rail is a static mockup with invented content. Story-Status and
  Nächste Schritte are real — steps are added inline, ticked off recording who completed them,
  and completed ones keep forever under an „Erledigt (N)“ disclosure unless deleted by hand.
- Post actions **Antworten**, **Zitieren** and **Merken** are inert; **Anmerkung schreiben**,
  which the design system lists as core copy, does not appear at all. The thread's **post
  filter** ("Alle Beiträge ▾") is gone from the interface for the same reason: its two real
  options are Gemerkt and Mit Anmerkungen, so it cannot filter anything until those exist. The
  design-system prototype keeps the specification, including the finding that it is one menu
  rather than a row of chips.

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

### 2. Profile fields

The overview and profile pages exist but answer only "who" — the interviews want them to answer
"ob die Person zu mir passen würde", which needs bio, genres, writing interests and what someone
is currently writing, plus a visibility setting for that block. Two constraints were decided
when the pages were built: **no statistics, ever** ("Profilaufrufe" etc. "führen nur zu Druck"),
and **nothing mandatory** — Yooco's required fields got filled with nonsense.

### 3. Story ideas — built, follow-ups included

§8's partner requests, reframed as **Storyideen**: an idea seeking writers, because that is
what members valued about the original ("Gesuche mit schon einer konkreten Idee"). Live: the
board (open ideas by default, the reader's own excluded — it is discovery, like public
groups), the detail page, posting, editing, an open/closed status (§8.3's intermediate states
were dropped — bookkeeping nobody would maintain), a language enum shared with groups, and a
Meine-Storyideen view. The seeking metadata deliberately started small — Konstellation stayed;
Umfang, Schreibrhythmus, Schreibstil and Verfügbarkeit were cut until someone misses them. The
story block mirrors `writing_group` column for column so an idea can one day become a group by
copying.

**"Unterhaltung beginnen" is built**, on ideas and beyond them: on an idea it creates a chat
titled after it and invites the author — §11's "public idea → private conversation", assembled
from parts that already existed — and on a public group's page it invites every joined
administrator, which is how a stranger asks into a group without any join-request machinery.
**"Gruppe gründen" on one's own idea is built too** — the create-group dialog opens prefilled
field for field (the idea's text becomes the blurb), which is what the matching columns were
kept in step for. The author still chooses visibility and confirms; the idea stays open until
they close it, deliberately — a fresh group of two might still want a third writer. With that,
§8 is done. Item 4 below stops being optional the moment testers get this board.

**A carousel view** (issue #20) reads the board one idea at a time, with the depth of the detail
page and arrow keys, swipe and buttons to move. Its set is fixed rather than inherited — open,
unread, not your own, newest first — which is why the route carries only the idea and no filters.
It walks by **id, not by position**: `QUERY /story-ideas/carousel` answers with an idea and the two
either side of it, so somebody posting an idea while you read cannot shift you sideways, the way an
offset would. A step replaces the URL rather than pushing it, so the back button leaves the
carousel instead of retracing every idea seen. It sits in the Storyideen menu beside the two
board views, and it is the one place in the product where something slides.

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

Users, roles, moderation queue, reports, settings. Needed once strangers can reach each other
at scale, which is to say once 7 exists.

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
