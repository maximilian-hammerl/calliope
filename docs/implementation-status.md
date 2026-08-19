# Implementation Status

How the built product compares with `product-requirements-feature-specification.md`,
`yooco-research-report.md`, `interviews.md` and the design system.

Written 19 August 2026. A snapshot, not a plan — it says what is there, not what to do next.

## Where the project stands

The defining feature is built. A member can register, sign in, create a private or public writing group, invite people,
manage their roles, open threads and write posts in them — which is the promise in §45, *"Create a private writing
group. Write together."*

Everything around that promise is thinner. There is no email, no profile, no public forum and no administration. The
product is usable by a group that already knows each other and has accounts; it is not yet usable by a community that
has to find each other, recover a password or report a problem.

## Against the MVP scope (§42)

| Area             | State                                                                                                                                          |
|------------------|------------------------------------------------------------------------------------------------------------------------------------------------|
| Accounts         | Registration, login, sessions. **No** email verification, password reset or profile.                                                           |
| Writing groups   | Complete: member-created, private/public, invitations with acceptance, roles, membership management, leaving, group discussions. **No** files. |
| Communication    | Group chat with live updates, and in-app notifications. **No** email delivery.                                                                 |
| Public forum     | Not started.                                                                                                                                   |
| Writing partners | Not started.                                                                                                                                   |
| Administration   | Not started.                                                                                                                                   |
| Privacy          | Not started — no account deletion, no data export, no GDPR configuration.                                                                      |

Two Phase 2 items (§43) arrived early because they were cheap alongside the group work:
group chat, and read-only group roles.

## The single biggest gap

**There is no email at all.** No verification, no password reset, no notification delivery. Password reset is the one
that bites first: a member who forgets their password today has no way back into their account, and §17 treats that as
table stakes. It also blocks the notification frequency controls in §38, which assume email exists.

## Deliberate departures

These are decisions, not omissions, and each is recorded where it was made:

- **Notifications are narrower than §38.** Only things addressed to a person — invitations, role changes, activity in
  your groups. "Followed topic activity" and a per-message chat notification were left out on purpose: the research is
  emphatic that the old platform's stats made members anxious, and a feed of everything you are missing is that same
  mechanic.
- **Chat has no notifications of its own.** Its unread count is the mechanism.
- **Search covers groups, threads and members, not posts.** Post search needs snippet extraction and an index before it
  is honest; the omission is deliberate and reversible.
- **Rich text is not merged.** A Tiptap editor exists on a branch, unmerged, because a requirement for a raw-HTML toggle
  arrived after it was built and has not been resolved.

## Specified but unbuilt in the interface

The design system describes several things the interface only mimics:

- The right rail's **Nächste Schritte**, **Story-Status** and **Dateien & Bilder** are static mockups with invented
  content.
- Post actions **Antworten**, **Zitieren** and **Merken** are inert buttons; **Anmerkung schreiben**, which the system
  lists as core copy, does not appear at all.
- **Mobile navigation** — the system specifies a bottom bar and rails as sheets. Neither exists; the top bar has
  absorbed the pressure three times now, and that is the point at which it stops absorbing.

## Correctly absent

Nothing has been built from §41's list of things not to prioritise — no gifts, flirt system, image voting or
gamification. The research describes all of them in Yooco; members did not ask for any of them.
