# Implementation Status

How the built product compares with `product-requirements-feature-specification.md`,
`yooco-research-report.md`, `interviews.md` and the design system.

Updated 19 August 2026. The first half says what is there; the roadmap at the end says what to
do next, and in what order.

**<https://calliope.hammerl.dev> is a testing environment, not production.** It is wiped when a
migration calls for it — most recently on 19 August 2026, when the database was dropped so
renamed migrations could re-run. Everyone with an account there is a beta tester who knows
this. Nothing on it should be treated as durable, and nothing about it should be read as a
production deployment.

## Where the project stands

The defining feature is built, and so is the account layer around it. A member can register,
confirm their address, sign in, recover a forgotten password, change their address or password,
create a private or public writing group, invite people, manage their roles, open threads and
write posts in them — the promise in §45, *"Create a private writing group. Write together."*

What is still missing is everything that makes a **community** rather than a set of groups:
there is no profile, no public forum, no administration and no way to delete an account. The
product is usable by people who already know each other; it is not yet usable by a community
that has to find each other, be moderated, or leave.

## Against the MVP scope (§42)

| Area             | State                                                                                                                                          |
|------------------|------------------------------------------------------------------------------------------------------------------------------------------------|
| Accounts         | Registration, address verification, login, sessions, password reset, password change, address change. **No** profile.                          |
| Writing groups   | Complete: member-created, private/public, invitations with acceptance, roles, membership management, leaving, group discussions. **No** files. |
| Communication    | Group chat with live updates, in-app notifications, transactional email. Chats are titled and invite-based, so **no** "message this member".   |
| Public forum     | Not started.                                                                                                                                   |
| Writing partners | Not started.                                                                                                                                   |
| Administration   | Not started.                                                                                                                                   |
| Privacy          | Not started — no account deletion, no data export, no GDPR configuration.                                                                      |

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
- **You cannot message a member who has not agreed to hear from you.** Chats are titled and
  invite-based, and a group works the same way: an invitation has to be accepted before anyone
  can write to you. This is deliberate — it means one member cannot simply start sending
  another messages. The residual is invitation spam, which is the smallest version of the
  problem and the one a *block a member* feature closes; that feature is on the roadmap below.
- **Search covers groups, threads and members, not posts.** Post search needs snippet
  extraction and an index before it is honest.
- **Rich text is not merged.** A Tiptap editor sits on the `text-editor` branch because a
  requirement for a raw-HTML toggle arrived after it was built and has not been resolved.
- **A 401 means "no session" unless a mutation is on a list.** `EXPECTED_401_MUTATIONS` in
  `lib/api/queryClient.ts` names the operations whose 401 is an *answer* — signing in, and the
  two that re-authenticate with the current password. Anything not on it is treated as a lost
  session and replaces the member onto the home page. `changePassword` was missing and was
  fixed on 19 August 2026; the symptom hid well, because the session survives and the redirect
  is invisible to anyone already on the home page. The list being a denylist-by-omission is the
  real issue and is unresolved: every future endpoint that re-authenticates has to remember to
  join it. Discriminating on the response body instead would be self-correcting, at the cost of
  matching on an error string.
- **No undo after an address change completes.** The window is the hour before, during which the
  old address can cancel. A real undo needs a longer-lived token and a policy for what
  reverting means.

## Specified but unbuilt in the interface

- The right rail's **Nächste Schritte**, **Story-Status** and **Dateien & Bilder** are static
  mockups with invented content.
- Post actions **Antworten**, **Zitieren** and **Merken** are inert; **Anmerkung schreiben**,
  which the design system lists as core copy, does not appear at all.
- **Mobile navigation** — the system specifies a bottom bar and rails as sheets. Neither exists.

## Correctly absent

Nothing has been built from §41's list of things not to prioritise — no gifts, flirt system,
image voting or gamification. Members did not ask for any of them.

---

# Roadmap

Ordered by what blocks what and by what the research says members came for, not by size. The
first is a day's work; items 5 to 7 are the bulk of the remaining MVP.

### 1. A group can lose its last administrator

Nothing in the service or the database stops the last administrator being removed or leaving,
which leaves a group nobody can administer. Deleting an account is now a third way in, since
the membership cascades. Small, understood, and it gets worse with every group created — and a
trigger beside the one that removes an empty group would close all three paths at once.

### 2. Mobile navigation — built

The bottom bar and the right rail as a sheet both exist. Below `md` the destinations move out
of the top bar, which keeps the wordmark, the search field and the avatar; below `lg` the rail
becomes a bottom sheet opened from a strip above the content. Before that sheet, the story
status, the next steps and the files had no route at all on a phone *or* a tablet.

Two departures from the specification, both deliberate. The bar holds **Gruppen and
Mitglieder** rather than the mockup's four items, because Forum and Partner are items 8 and 4
and do not exist yet.

And the rails were **re-cut by purpose rather than by side**. The left rail stopped listing
groups: the interviews describe a daily sweep — scan every group for new replies, then answer
several — and a rail of bare titles cannot say which group changed, where the overview sorted
by last activity can. So navigation went to the overview and the bottom bar, and the left rail
became the story's reference card: genre, tropes, tense, perspective, content warnings, files,
members. The right rail keeps what a member *does* — next steps, and the story status, now
with a switcher instead of a trip through the edit dialog. On a phone the two merge into one
sheet, action first.

Every interactive target on every surface is now at least 44px on a phone, checked at 375×667
as well as 375×812. Most of it came from three generated components — the button's `sm` and
`default` sizes, the dropdown menu item, and both dialog content components — because a
component-level fix covers every call site at once. The ones that had to be fixed by hand were
the text links and hand-rolled buttons, which is the category no component covers.

### 3. Member overview and member profile

Two pages, not one: a **member overview** listing who is here, and a **member detail page** —
the profile. Both are named in §42's account list, and the interviews say plainly what they are
for: members read profiles "um direkt schauen zu können, ob die Person zu mir passen würde".

It also finishes something already half-built — search returns members but has nowhere to send
you.

One constraint comes straight from the research: profile **statistics must not be public**.
Members named "Profilaufrufe", "Zuletzt online" and "Online Zeit" as things that "nur zu Druck
führen, weil man sich mit anderen vergleicht". That is the same instinct behind §41 and behind
the narrower notifications above.

### 4. Find writing partners (§8)

A public board of structured **requests** — title, idea, genres, style, what you are looking
for, format, availability — with filters and a status (open, discussing, partners found,
closed). §8 insists it is "a first-class feature, not just another forum category", so it does
**not** wait for the general forum; it is its own model and its own board.

It is placed this high because the interviews are unambiguous that it is why people were on
Yooco at all: it is what one member joined for ("Speed-Date Funktion […] war die überzeugende
Funktion"), and both named "neue Schreibpartner finden" as the reason the public area matters.
Together with 3, it is the pair that brought members in.

### 5. Block a member

The complement to 4. Once strangers can reach each other through a public board, the invitation
spam described above stops being theoretical. Small on its own, and cheap while the surfaces
that can carry a message are still few.

### 6. Personal data export (§18, §42)

**Deletion is built**; export is what is left of this item. A member deletes their account from
the settings dialog: current password, then a mailed link, and only opening that link deletes
anything. The question this item used to pose is answered and the answer was already in the
schema — authorship goes null and the text survives, and the triggers that drop a group once
its last member leaves fire on the cascade too, so a group nobody is left in goes with the
account while one that still has members stays. There is nothing in the service about groups
at all.

What deletion does *not* do is fill the hole in 1: a member who was a group's only
administrator can now leave by deleting their account, and the group is left with members and
no administrator. It is the same hole leaving already opens, not a new one, and fixing it in
the trigger fixes both paths at once.

Export is still worth doing before files and the forum, for the reason deletion was: each
feature added first makes it a larger surface to walk.

### 7. Files in writing groups

The last item in §42's writing-group list, and the one the right rail already pretends to have.
Needs storage, a size policy, and a decision about what leaves the server when an account is
deleted — the one part of that flow a foreign key cannot answer on its own.

### 8. Public forum, with moderation (§9, §15, §16)

The largest remaining block: categories, topics, replies, search, attachments. Moderation and
reporting belong in the same change rather than after it — a public space without them is one
that cannot be run.

### 9. Administration (§42)

Users, roles, moderation queue, reports, settings. Needed once strangers can reach each other
at scale, which is to say once 8 exists.

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
