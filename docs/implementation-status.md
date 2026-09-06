# Implementation Status

How the built product compares with `product-requirements-feature-specification.md`,
`yooco-research-report.md`, `interviews.md` and the design system.

**The specification is an inspiration, not a fixed specification.** It records what the community
had and what it asked for; what gets built is decided issue by issue, and where the two differ, the
issue and the "Deliberate departures" below are the record. A section is cited as `§N` for where an
idea came from, not as a requirement to be ticked off.

Updated 6 September 2026. The first half says what is there; the roadmap at the end says what is
left of the first release, and in what order.

**<https://calliope.hammerl.dev> is a testing environment, not production.** Committed migrations
are edited in place while it is the only deployment, so it is wiped whenever one of them changes.
Everyone with an account there is a beta tester who knows this. Nothing on it should be treated as
durable, and nothing about it should be read as a production deployment.

## Where the project stands

The product is now a community, not only a set of groups. The account layer, private and public
writing groups, story ideas, chats, favourites, blocking, reporting and moderation were in place by
the last snapshot; since then the largest remaining block landed.

**The public forum (#32)** is built: rooms as folders, threads to discuss and pages to maintain,
posts with the same editor as a group's, and one permission per row — `hidden`, `read` or `write`
for members, with operators seeing and doing everything. A folder only ever narrows what is inside
it, a hidden room answers 404 rather than 403, and a read-only thread says so where its composer
would be. Search covers the forum's threads and page prose in sections of their own. The seed
follows a member's draft of the real structure: Administratives, Events, Community,
Schreibwerkstatt.

**Groups gained the same structure**: pages (#109) for material that is maintained rather than
discussed, and folders (#110) to arrange threads and pages. A member can now leave a group (#26), an
administrator can change a role after the invitation (#27), and the interface warns before a group
loses its last administrator (#28) instead of a trigger refusing it. Threads and posts can be edited
and deleted (#56, #57, #68, #69).

**Posts are rich text (#44).** A post's body is a document tree in `jsonb`, written in a Tiptap
editor with headings, lists, alignment, colour, font and line height (#81), and a „Formatierung
entfernen" button; HTML is only ever a render target. The composer can be resized by dragging its
top edge (#84), and the plain-text projection keeps search and report excerpts working.

**A profile has a face and a frame**: seven optional free-text fields about how somebody writes
(#29), an uploaded avatar (#94), and the member's platform role shown as a word so a claim to
moderate can be checked (#101). **Story metadata comes from controlled lists (#75)** — genres,
subgenres, tropes, tense, perspective, content warnings — so groups and ideas filter by it, with
uniform, collapsible filters and a reset.

**Administration exists**: platform roles (#21), reporting of eight kinds of thing (#22), the
operators' queue at `/moderation` (#23) with a lifecycle and an audit trail (#66, #67), and banning
an account (#24). **Sessions are listed and revocable (#33)**, one at a time or all but the current.

Around the edges: a chat invitation can be declined and a chat left (#72), consecutive messages
from one person read as a block (#92), a member can choose a dark appearance (#60), the interface
says which instance it is on (#61), and Impressum (#86) and Datenschutzerklärung (#87) are reachable
from a footer that also links the source. Underneath: CSRF protection, a breached-password check
and an eight-character minimum, tightened Deno permissions, rate limits the frontend answers to, and
every database write inside a transaction, which the compiler now enforces.

What is still missing from the first release is listed in the roadmap: data export, images and
files, an operator's power to remove content, unread marks in the forum, a landing screen, and mail
that survives a restart.

## Against the MVP scope (§42)

| Area             | State |
|------------------|-------|
| Accounts         | Registration, address verification, login, sessions with a list and revocation, password reset and change, address change, account deletion. A profile with seven optional fields and an avatar, readable by every member and by nobody without an account. |
| Public forum     | Folders as categories, threads as topics, replies, pages, search, per-row permissions, and moderation through the report queue. **No** attachments (#31, #95) and **no** unread or subscriptions (#119). |
| Writing partners | Built as **Storyideen**: board, detail page, carousel, statuses, controlled story metadata, „Unterhaltung beginnen" with the author, and „Gruppe gründen" from one's own idea. |
| Writing groups   | Member-created, private/public, invitations with acceptance, roles that can change, leaving, threads, pages, folders, next steps. **No** files. |
| Favourites       | One mechanism over groups, threads, posts, pages, story ideas and chats (#73): a private mark that floats the thing to the top of its list, except among posts, where the mark drives the filter and the thread keeps its reading order. |
| Communication    | Group chat with live updates, decline and leave, in-app notifications, transactional email. A conversation starts from an idea or a public group; blocking refuses one. **No** open "message this member". |
| Administration   | Platform roles, reporting, the queue with its lifecycle, banning. **No** removing reported content (#62), operator view of a member (#46) or of a group (#47), no transfer of a group's administration (#49), no settings screen. |
| Privacy          | Account deletion, blocking, Datenschutzerklärung and Impressum. **No** data export (#30), no privacy settings. |

Two Phase 2 items (§43) arrived early because they were cheap alongside the group work: group
chat and read-only group roles.

## Email and account security (§17)

All of §17's *required* list is met, session revocation included. Verification gates the account
behind a wall that still allows signing in, so a mistyped address can be corrected. Reset,
verification and address change run on one `user_token` table with a purpose enum and one-hour
links; a link is one-time and only the newest one is valid, and the interface says so.

Mail relays through an external SMTP account rather than the VPS. SPF, DKIM and DMARC pass. Two
gaps remain and are recorded in `deployment/README.md`: **bounces are read by a person** (#40) and
**mail in flight is lost on restart** (#41).

## Deliberate departures

These are decisions, not omissions, and each is recorded where it was made:

- **Notifications are narrower than §38.** Only things addressed to a person. "Followed topic
  activity" and a per-message chat notification were left out on purpose: the research is
  emphatic that the old platform's stats made members anxious, and a feed of everything you are
  missing is that same mechanic. Unread and subscriptions for the forum are #119, still open.
- **Chat has no notifications of its own.** Its unread count is the mechanism.
- **Steps tell nobody and move nothing.** Ticking a step produces no notification and does not
  touch `last_activity_at` — planning is not writing, and the group list must not reorder because
  somebody ticked a box.
- **You cannot message a member who has not agreed to hear from you.** Chats are titled and
  invite-based, and a group works the same way. The residual is invitation spam, which blocking
  closes: neither side can invite the other, and the invitations already outstanding are withdrawn.
- **Search covers groups, threads, pages, the forum, story ideas and members — not posts, chat
  messages or next steps.** Post search needs snippet extraction and an index before it is honest.
- **A post is a document tree, not HTML or Markdown.** The client sends what the editor emits and
  the server validates it against a closed allowlist: an unknown node is refused, not stripped. A
  stored colour is literal, so the dark appearance cannot recolour posts already written.
- **A 401 means "no session" unless it says `code: invalid_credentials`.** The code is how a wrong
  password is told from a lost session (#43 replaced the list of exceptions); only logging out
  remains exempt, since signing out of an ended session is not an error.
- **The forum has no administrators.** Structure and permissions are operators' work; members hold
  no role in it. A row keeps its own setting beside the effective one, so re-opening a folder
  restores what was set inside it.
- **A closed report is final.** Taking and closing are the two moves; there is no reopening. A
  closed report no longer blocks the same member reporting the thing again, so a live problem
  returns to the queue on its own, and a lifecycle that only goes forward is its own record (§16).
- **A group may lose its last administrator (#28).** The interface warns when you leave or give up
  your own role as the last one; nothing refuses it. A database guard would have to exempt account
  deletion, or a group role would stand in the way of erasure. The state has not occurred; #49 is
  the remedy if it does.
- **Both bars hold four destinations.** Gruppen and Storyideen open menus of their pages, Forum
  and Mitglieder are links.
- **The rails are cut by purpose, not by side.** Left is reference, right is action; on a phone both
  are one sheet. The design system carries the full reasoning.
- **No undo after an address change completes.** The window is the hour before, during which the
  old address can cancel.
- **Profile fields carry no visibility setting (§10, §18).** Nothing here is readable without an
  account, every field is optional, and the fields exist to be read by a stranger who has not
  written with you yet — the one audience a group-scoped level would hide them from. A sentence
  beside the fields, saying who can read them, replaces the setting.

## Specified but unbuilt in the interface

- **The files block** in the group rail („Dateien & Bilder") is still a placeholder with invented
  content (#31).
- **Quoting (#36)** and **annotations (#38)** are specified in the design system's copy and not
  built; both are in v2. The thread's post filter has the one of its options that exists,
  „Favoriten"; „Mit Anmerkungen" joins it with #38.

## Correctly absent

Nothing has been built from §41's list of things not to prioritise — no gifts, flirt system,
image voting or gamification. Members did not ask for any of them.

---

# Roadmap

What is left in the `v1` milestone, ordered by what blocks what. Everything accepted for later is
in `v2`; everything still `status: proposed` has no milestone.

### 1. Personal data export (#30)

Deletion is built; export is the other half of §18's pair. Every feature added first makes it a
larger surface to walk, which is why it comes before images and files.

### 2. Images inside a post (#95), then files (#31)

Images uploaded rather than linked, in groups and the forum, on the avatar storage that #94 built.
Files other than images (#31) are still proposed: storage policy, size limits, and what leaves the
server when an account is deleted are the open questions.

### 3. An operator can remove content (#62)

The hole an operator meets most: every content delete is gated on the author or the group's
administrator, and no operator path exists. The rest of the acting — an operator's view of a member
(#46), of a group (#47), transferring a group's administration (#49) — is v2 or proposed.

### 4. Unread and subscriptions in the forum (#119)

What tells a member something happened in a room they read. Has to stay on the right side of the
notifications departure above.

### 5. Editable story vocabularies (#121)

Genres, subgenres, tropes and the rest are Postgres enums today, so adding a genre is a deploy.
Normalised tables with foreign keys are the decided shape; #122 (the eleven story columns that
`writing_group` and `story_idea` duplicate) is the proposed follow-up.

### 6. A first screen worth landing on (#34)

The home page is a placeholder until it is known what belongs on it.

### 7. Mail in flight survives a restart (#41)

An outbox written in the same transaction as the token, so a token cannot exist unannounced.

## Smaller things, unscheduled

- **Registration reveals whether an address is in use** through its 409 (#39, v2).
- **Bounce handling** over IMAP would replace the manual check (#40, v2).
- **Post search**, once an index and snippet extraction are worth it.
