# Modern Replacement for Yooco

## Product Requirements & Feature Specification for a Collaborative Writing Community

**Document status:** Product concept / requirements baseline  
**Intended audience:** Community founders, product/design contributors, developers, moderators  
**Primary audience:** Members of an established German-speaking writing community

---

# 1. Product Vision

The new platform should not simply reproduce Yooco with a newer visual design.

It should preserve what made the existing community valuable — **a public social forum where people meet, talk, discover
one another, and form lasting writing relationships** — while making the collaborative-writing workflow substantially
better.

The central concept is:

> **A public community containing many private, member-created writing groups.**

A member should be able to move naturally through the following journey:

```text
Discover the community
        ↓
Create an account
        ↓
Participate in public discussions
        ↓
Find a writing partner / present a story idea
        ↓
Meet one or more interested writers
        ↓
Create a private writing group
        ↓
Invite additional writers, readers or collaborators
        ↓
Plan and write the story together
        ↓
Optionally share the finished story with a wider audience
```

The platform should therefore feel like a **writers' clubhouse, forum, and collaborative story workspace in one
product**.

It should remain understandable to people who are accustomed to a traditional forum, while feeling modern, fast,
mobile-friendly, private where necessary, and easy to operate for a non-commercial German community.

---

# 2. Product Principles

## 2.1 Community first

The platform is a community, not merely a document editor.

People should be able to:

- discover discussions,
- get to know other writers,
- exchange ideas,
- find collaborators,
- form groups,
- follow stories,
- participate casually without having to write stories themselves.

The public community must remain valuable even for members who are not currently part of a writing project.

## 2.2 Private by default for collaborative stories

A newly created writing group should be private unless its members deliberately choose to share it.

A writer should never have to worry that an unfinished story, character idea, plot twist, or experimental draft is
accidentally visible to the public.

## 2.3 Member-created spaces

The defining workflow should not require an administrator every time two writers want to collaborate.

Ordinary members should be able to:

- create a writing group,
- name it,
- describe it,
- invite people,
- manage membership within the permissions granted to them,
- create discussions,
- organize the group's material.

The administrator should govern the platform rather than manually operating every individual writing project.

## 2.4 Familiar forum model

The product should retain the mental model of:

**categories → forums/spaces → topics → posts**

rather than turning the entire community into an ephemeral chat application.

Long-running stories need durable, searchable, linkable content.

## 2.5 Modern, not complicated

The interface should feel contemporary without forcing users to learn a completely new collaboration paradigm.

The platform should prioritize:

- clean navigation,
- obvious actions,
- good typography,
- excellent mobile behavior,
- fast page loads,
- clear notifications,
- predictable privacy.

## 2.6 Community ownership and portability

The community should not be trapped in a proprietary SaaS platform.

The preferred architecture should provide:

- self-hosting,
- EU/German hosting options,
- database access,
- media access,
- export facilities,
- documented APIs,
- backups,
- migration tooling.

Yooco's research identified a major limitation here: there is no publicly documented API, SDK, webhook system, or
general-purpose data export mechanism.

The replacement should explicitly avoid reproducing that dependency.

---

# 3. What Must Be Preserved from Yooco

The replacement should preserve the following broad characteristics of the current community.

Yooco provides a social-network-oriented environment containing profiles, forums, private messaging, chat, galleries,
videos, events, blogs, groups, custom pages and additional community functions.

Not all of these need to be copied literally. The important task is to preserve the **community behavior** they enable.

## 3.1 Public discussion

The platform needs a conventional public forum where members can talk about:

- everyday topics,
- writing,
- books,
- films,
- games,
- hobbies,
- community matters,
- announcements,
- anything else the community considers appropriate.

The public forum should support an essentially unlimited number of categories/forums/topics rather than forcing
everything into one feed.

## 3.2 Profiles

Every member should have a profile containing, according to the privacy settings:

- display name,
- avatar,
- short biography,
- writing interests,
- genres,
- favorite authors/books,
- optional links,
- activity,
- joined groups,
- reputation/achievement information if enabled.

The current Yooco model gives every member a profile and supports configurable personal/profile data.

## 3.3 Private communication

The platform should retain:

- direct/private messages,
- notifications,
- optional private conversations involving multiple participants.

Public chat may be useful, but private conversations are more important to the writing-partner workflow.

## 3.4 Media

Images and files are important to writers.

Members should be able to upload:

- character images,
- maps,
- reference pictures,
- cover artwork,
- documents,
- attachments,
- illustrations.

Yooco currently provides image/video galleries and file downloads with storage limits depending on the plan.

The replacement should improve this with proper permissions and predictable storage rules.

## 3.5 Events

The platform should support a basic event/calendar feature for:

- online writing sessions,
- community meetings,
- conventions,
- meetups,
- writing challenges,
- birthdays or other community events if desired.

## 3.6 Blogs / long-form public writing

A lightweight blog/article capability can remain useful for:

- writing advice,
- announcements,
- essays,
- reviews,
- project introductions,
- community news.

However, this should remain subordinate to the forum and collaborative-story system.

---

# 4. Core Information Architecture

The platform should have the following conceptual layers.

```text
COMMUNITY
│
├── Public Forum
│   ├── Categories
│   ├── Forums / Spaces
│   ├── Topics
│   └── Posts
│
├── Members
│   ├── Profiles
│   ├── Search
│   └── Direct Messages
│
├── Find Writing Partners
│   ├── Partner requests
│   ├── Story ideas
│   └── Collaboration offers
│
├── My Writing Groups
│   ├── Group A
│   │   ├── Discussions
│   │   ├── Story
│   │   ├── Characters
│   │   └── Planning
│   │
│   ├── Group B
│   └── Group C
│
├── Stories
│   ├── Private
│   ├── Shared
│   └── Published / Community-readable
│
└── Community Services
    ├── Events
    ├── Media
    └── Announcements
```

The distinction between **a user, a writing group, and a story** should be explicit.

A writing group is not necessarily identical to a single story.

A group may eventually contain:

- one story,
- several related stories,
- spin-offs,
- planning discussions,
- shared world-building information.

This makes the system more future-proof than assuming every group equals one thread.

---

# 5. The Defining Feature: Writing Groups

## 5.1 Concept

A **Writing Group** is a private sub-community created by one or more ordinary members for collaborative writing.

A group should have:

- name,
- description,
- avatar/banner,
- creator/owner,
- members,
- roles,
- privacy setting,
- creation date,
- last activity,
- discussions,
- files/media,
- optional stories/projects.

## 5.2 Creation workflow

The primary action should be:

> **Create a Writing Group**

The form should request at minimum:

```text
Name
Description
Privacy
Initial members
```

Possible privacy modes:

### Private

Nobody outside the group can discover or access the content.

### Invite-only

The group may be discoverable as an object, but participation requires invitation.

### Community-visible

The group and its basic information are visible, but its content remains private.

### Public

The group intentionally opens its content to the wider community.

The exact set of modes can be simplified in the first release. **Private** and **Public** are the essential modes.

## 5.3 Membership

A user can belong to many writing groups simultaneously.

Membership should support:

- invitation,
- accepting/declining,
- removal,
- leaving voluntarily,
- membership requests if enabled,
- roles.

A user should have a dedicated:

> **My Writing Groups**

area.

Example:

```text
My Writing Groups

The Kingdom of Ash
4 members · 23 discussions · Active today

Moonlight & Roses
2 members · 8 discussions · Active yesterday

Project Aurora
5 members · 41 discussions · Active 3 days ago
```

## 5.4 Roles

At minimum:

### Group Owner

- manage group settings,
- invite/remove members,
- assign moderators,
- archive/delete group where appropriate.

### Group Moderator / Co-owner

- manage members if permitted,
- moderate discussions,
- organize content.

### Writer / Member

- read private content,
- create and reply to discussions,
- upload files according to group permissions.

### Reader / Guest

Optional but highly desirable.

- read content,
- cannot alter the story.

This role is particularly useful for beta readers, editors, friends, or invited guests.

---

# 6. Concrete Alice-and-Bob Story Workflow

This is the most important acceptance test for the system.

## Step 1 — Alice publishes an idea

Alice posts in:

> **Find Writing Partners**

Example:

> I have an idea for a fantasy story set in a city where memories can be traded. Looking for one or two writers who
> enjoy character-driven stories.

Other members can respond.

## Step 2 — Bob expresses interest

Bob replies publicly or contacts Alice privately.

Alice and Bob discuss the idea.

## Step 3 — Alice creates a group

Alice selects:

> **Create Writing Group**

She enters:

> **The Memory Market**

and invites Bob.

## Step 4 — Private area is created automatically

The platform creates:

```text
🔒 The Memory Market

Overview
Members
Discussions
Files
```

Possible initial discussion areas:

```text
📖 Story
💡 Ideas & Planning
👤 Characters
🌍 World Building
📚 Research
💬 General
```

The group should not require an administrator to create forums manually.

## Step 5 — Bob accepts

Bob sees the invitation and accepts.

He immediately gains access to the private group.

## Step 6 — They start writing

They can create:

> **Chapter 1 — The Market Opens**

and reply to each other with successive contributions.

Alternatively, the group can organize the story into separate topics or chapters.

## Step 7 — They invite Carol

Carol is a beta reader.

Alice selects:

> **Invite Member**

and assigns:

> Reader

Carol can now read the material but cannot change it.

## Step 8 — They decide to share it

When the story is complete, the group can change its visibility:

> **Private → Community-visible**

or publish a curated version into a public forum.

This should be a deliberate action and require group-owner permission.

---

# 7. Collaborative Story Features

## 7.1 Discussions / chapters

Every story should be composed of ordinary persistent discussions/topics rather than ephemeral chat.

Each item should provide:

- title,
- author,
- creation date,
- modification date,
- replies,
- attachments,
- reactions,
- watch/follow,
- permissions.

## 7.2 Drafting

A contributor should be able to compose a post as a draft before publishing.

Nice-to-have:

- autosave,
- revision history,
- preview,
- formatting toolbar,
- Markdown support,
- drag-and-drop images/files.

## 7.3 Revisions

Story writing makes editing unusually important.

The system should preferably retain a revision history showing:

- who changed a post,
- when,
- what changed.

Moderators/owners should be able to restore previous revisions where appropriate.

## 7.4 Story organization

A story should support:

- chapter numbering,
- ordering,
- pinned reference discussions,
- table of contents,
- optional status: planning / writing / finished / archived.

## 7.5 Story metadata

Optional:

- genre,
- rating/content warning,
- status,
- synopsis,
- authors,
- tags,
- cover image.

---

# 8. Public "Find Writing Partners" Area

This should be treated as a **first-class feature**, not just another forum category.

## 8.1 Partner request

A member should be able to create a structured request:

```text
Title
Short idea
Genres
Writing style
What I am looking for
Expected collaboration format
Availability
```

Optional metadata:

- one-to-one / group,
- short story / serial / novel,
- synchronous / asynchronous,
- beginner-friendly,
- experienced writers,
- age/content rating.

## 8.2 Discovery

Members should be able to filter requests by:

- genre,
- format,
- number of participants,
- activity,
- language,
- status.

## 8.3 Status

A partner request can be:

- Open
- Discussing
- Partners found
- Closed
- Archived

This prevents old requests from cluttering the forum.

---

# 9. Forum Requirements

The public forum should remain a full-featured forum.

## Topics

Support:

- title,
- tags,
- replies,
- attachments,
- reactions,
- bookmarks,
- subscriptions,
- edit history,
- moderation,
- pinning,
- locking,
- moving,
- merging.

## Search

Search should cover:

- public discussions,
- profiles,
- groups the user can access,
- stories the user can access.

**Private content must never appear in results for unauthorized users.**

## Bookmarks / follows

Members should be able to bookmark:

- topics,
- posts,
- stories,
- writing groups.

## Notifications

Notifications should cover:

- replies,
- mentions,
- quotes,
- private messages,
- group invitations,
- group membership changes,
- followed topic activity.

Users should control notification frequency.

---

# 10. Profiles and Social Features

The platform should retain the social aspect of Yooco.

The member profile should provide:

```text
Avatar
Display name
Bio
Genres
Writing interests
Currently writing
Joined date
Public activity
Writing groups (optional)
```

Privacy should be granular.

A member should be able to choose which profile fields are visible:

- everyone,
- registered members,
- group members,
- nobody.

## Friend/follow relationship

A lightweight follow/friend mechanism may be useful, but it should not become more important than the writing community
itself.

---

# 11. Private Messaging

Private messages should support:

- one-to-one conversations,
- multi-user conversations,
- attachments,
- notifications,
- blocking/reporting,
- message deletion rules.

A writing-partner search should make moving from:

> public idea → private conversation → writing group

very easy.

---

# 12. Media and Files

The replacement should improve substantially on the basic storage model of Yooco.

Yooco provides image/video galleries and a plan-based storage quota.

A modern system should use:

- per-user uploads,
- per-group files,
- per-story attachments,
- image previews,
- basic image processing,
- configurable file size limits,
- storage quotas,
- virus/malware scanning where feasible,
- permission inheritance.

Files must respect the same privacy boundaries as their parent group/story.

A private group's uploaded image must never accidentally become a public URL.

---

# 13. Events

Provide an optional event/calendar module.

An event should support:

- title,
- description,
- date/time,
- location or online link,
- organizer,
- attendee list,
- RSVP,
- reminders.

Possible use cases:

- community meetings,
- writing nights,
- NaNoWriMo-style activities,
- conventions,
- real-world meetups.

---

# 14. Chat

Chat should be supplementary, not the main content model.

### Public chat

Optional.

### Group chat

Very useful.

Every writing group could have an optional real-time chat for:

> "Are we going with chapter 4?"

But the actual story should remain in persistent discussions.

This prevents important writing material from disappearing in a chat stream.

---

# 15. Moderation

The platform must give community administrators strong moderation capabilities without making them responsible for
everyday management of every writing group.

## Global moderators

Should be able to:

- edit/delete/move/lock content,
- ban/suspend users,
- review reports,
- manage public categories,
- manage site-wide permissions.

## Group moderators

Should be able to moderate only their own groups.

This gives the system a hierarchy:

```text
Platform Administrator
        ↓
Global Moderator
        ↓
Writing Group Owner
        ↓
Writing Group Moderator
        ↓
Writer
        ↓
Reader
```

A group owner should never gain the ability to moderate outside their own group merely because they own a writing group.

---

# 16. Reporting and Safety

Users need a prominent:

> **Report**

action for:

- posts,
- private messages where legally/technically appropriate,
- profiles,
- uploaded files,
- group content.

Reports should enter a moderator queue.

The system should record:

- reporter,
- reported item,
- reason,
- timestamp,
- moderator action,
- resolution.

Moderation actions should be auditable.

---

# 17. Authentication and Account Security

Yooco currently uses email/password authentication, persistent login and password reset, with no documented social login
or 2FA.

A modern replacement should preserve email/password while improving security.

## Required

- email verification,
- strong password hashing,
- password reset,
- secure persistent sessions,
- session revocation,
- login attempt protection,
- rate limiting,
- HTTPS everywhere.

## Strongly recommended

- 2FA / TOTP,
- passkeys,
- optional OAuth/OIDC login,
- active-session management.

Social login should remain optional rather than mandatory.

---

# 18. Privacy and GDPR

The replacement should be designed for **privacy by default**, not merely retrofitted for GDPR later.

## Required

- privacy policy page,
- terms/house rules,
- consent handling where required,
- account deletion,
- personal-data export,
- privacy controls,
- configurable profile visibility,
- data-processing documentation,
- administrator audit tools.

Yooco's current model already recognizes user access and deletion rights and uses TLS.

The new platform should make those processes more transparent and preferably self-service.

## Data minimization

Do not collect fields merely because they might be useful.

The minimum account should ideally require:

- email,
- password,
- display name.

Everything else should be optional unless genuinely necessary.

## Analytics

The product should avoid automatically embedding a large set of third-party tracking services.

Yooco's research notes Google Analytics, reCAPTCHA, Google-related resources and advertising infrastructure.

A modern community could instead use:

- no analytics,
- privacy-friendly self-hosted analytics,
- or strictly minimized analytics.

## Hosting

Preferred:

> **German or EU hosting**

for:

- application,
- database,
- media,
- backups.

---

# 19. Technical Architecture

The system should be designed as a modern web application, but the exact framework should remain an implementation
decision.

Required architectural characteristics:

### Backend

- modular architecture,
- relational database,
- background job system,
- robust permissions,
- full-text search,
- audit logging.

### Frontend

- responsive,
- mobile-first,
- accessible,
- fast,
- progressive enhancement where practical.

### API

Unlike Yooco, the replacement should expose a documented API.

Yooco has no publicly documented API, SDK or webhook infrastructure.

The new platform should provide:

```text
REST and/or GraphQL API

Authentication
Users
Profiles
Groups
Membership
Topics
Posts
Stories
Files
Events
Notifications
Moderation
```

### Webhooks

Useful events include:

```text
user.created
group.created
group.member_added
group.member_removed
topic.created
post.created
story.published
event.created
```

---

# 20. Data Model

A conceptual data model might look like:

```text
User
 ├── Profile
 ├── Membership[]
 ├── PrivateMessage[]
 ├── Topic[]
 └── Post[]

Community
 ├── Category[]
 ├── Forum[]
 ├── User[]
 └── WritingGroup[]

WritingGroup
 ├── Owner
 ├── Member[]
 ├── Role[]
 ├── Discussion[]
 ├── Story[]
 ├── File[]
 └── Settings

Story
 ├── WritingGroup
 ├── Author[]
 ├── Chapter[]
 ├── Metadata
 └── Visibility

Chapter / Discussion
 ├── Author
 ├── Post[]
 ├── Attachment[]
 └── Revision[]
```

---

# 21. Permissions Model

Permissions should be explicit and composable.

A permission should answer:

> **Who may perform which action on which object?**

Example:

```text
PUBLIC FORUM
Registered members:
  view         ✅
  create       ✅
  reply        ✅

PRIVATE GROUP
Group members:
  view         ✅
  create       ✅
  reply        ✅
  upload       ✅

Non-members:
  view         ❌
  create       ❌
  reply        ❌

GROUP READER
  view         ✅
  create       ❌
  reply        ❌
```

Permissions should be inherited where sensible, but local overrides must be possible.

---

# 22. Group Lifecycle

Writing groups should not remain clutter forever.

A group should have a lifecycle:

```text
Active
  ↓
Inactive
  ↓
Archived
  ↓
Deleted
```

## Archive

An archived story remains readable to members but no longer accepts new content.

## Restore

An authorized group owner/admin can restore an archived group.

## Delete

Deletion should require an explicit confirmation and perhaps a grace period.

For valuable stories, a backup/export should be encouraged before deletion.

---

# 23. Story Visibility Lifecycle

A story should support:

```text
Private
   ↓
Group-visible
   ↓
Community-visible
   ↓
Public / Published
```

This is an important distinction.

The writing process should happen privately.

Sharing should be deliberate.

---

# 24. User Experience

## Desktop

A simple three-column or two-column structure is appropriate:

```text
┌───────────────┬─────────────────────────────┐
│ Navigation    │ Main Content                │
│               │                             │
│ Home          │ Latest discussions          │
│ Forum         │                             │
│ Find Writers  │                             │
│ Groups        │                             │
│ Messages      │                             │
│ Events        │                             │
│ Profile       │                             │
└───────────────┴─────────────────────────────┘
```

## Mobile

The primary navigation should expose:

- Home
- Forum
- Groups
- Messages
- Notifications
- Profile

without requiring a desktop-style sidebar.

---

# 25. "My Space"

Every user should have a personalized dashboard.

Example:

```text
Good evening, Alice

Your activity
────────────────────────

🔔 3 new replies
✉️ 1 message
👥 1 group invitation

Your writing groups
────────────────────────

The Kingdom of Ash
Active 10 minutes ago

Moonlight & Roses
Active yesterday

Project Aurora
No new activity

Followed discussions
────────────────────────
...
```

This is one of the most useful improvements over a traditional forum.

The user should not have to manually search for everything they participate in.

---

# 26. Search and Discovery

Search should be one of the platform's core functions.

Users should be able to search:

- public discussions,
- posts,
- members,
- writing-partner requests,
- accessible groups,
- accessible stories,
- files.

Filters should include:

- author,
- date,
- category,
- tag,
- genre,
- group,
- content type.

**Authorization must be applied before search results are returned.**

Private content should effectively not exist from the point of view of an unauthorized user.

---

# 27. Accessibility

The platform should meet at least **WCAG 2.2 AA** where practical.

Important basics:

- keyboard navigation,
- semantic HTML,
- visible focus,
- adequate contrast,
- accessible forms,
- screen-reader labels,
- no essential information conveyed by color alone,
- resizable text,
- accessible dialogs and menus.

---

# 28. Performance

The new platform should feel substantially faster than a traditional page-heavy social network.

Targets should include:

- fast first contentful paint,
- optimized image delivery,
- lazy-loading galleries,
- efficient pagination,
- cached public content,
- asynchronous notifications,
- background processing for heavy operations.

A CDN such as Cloudflare could be used in front of the application, similar to the protection/CDN role observed in the
current Yooco environment.

But third-party services should be chosen deliberately from a privacy perspective.

---

# 29. Administration

The administrator dashboard should provide:

## Community

- name
- logo
- domain
- theme
- navigation
- registration mode

## Members

- search,
- suspend,
- delete,
- permissions,
- roles,
- groups.

## Forum

- categories,
- forums,
- topics,
- moderation.

## Writing groups

- overview,
- search,
- moderation,
- ownership transfer,
- archival,
- deletion.

## Privacy

- privacy settings,
- exports,
- deletion requests,
- data retention,
- consent settings.

## System

- backups,
- storage,
- mail,
- logs,
- health,
- updates.

---

# 30. Community Roles

The platform should distinguish **technical roles** from **social labels**.

This is a deliberate improvement over Yooco.

Yooco's "user groups" are primarily labels displayed on profiles and do not themselves grant technical permissions;
actual rights are controlled separately.

The replacement should allow:

### Site roles

- Founder / Owner
- Administrator
- Global Moderator
- Member
- Suspended Member

### Group roles

- Owner
- Moderator
- Writer
- Reader

### Optional profile labels

- Moderator
- Beta Reader
- Author
- Artist
- VIP
- Community helper

These labels should be cosmetic unless deliberately connected to permissions.

---

# 31. Themes and Branding

The community should be able to establish its own identity.

Required:

- logo,
- favicon,
- primary/secondary colors,
- typography,
- banner,
- custom navigation,
- custom homepage.

Optional:

- custom CSS,
- custom domain,
- email templates,
- custom legal pages.

Yooco places considerable emphasis on community layout/design customization and higher plans can remove Yooco branding.

The replacement should provide these capabilities without tying branding freedom to an expensive plan.

---

# 32. Email

The platform should send transactional email for:

- registration verification,
- password reset,
- group invitations,
- direct messages,
- mentions,
- watched-topic activity,
- moderation actions,
- event reminders.

Users must be able to control email notification frequency.

The system should avoid sending unnecessary email by default.

---

# 33. Anti-Spam and Abuse Prevention

The platform should include:

- email verification,
- rate limiting,
- IP-based abuse controls,
- registration throttling,
- content flood protection,
- optional CAPTCHA,
- report system,
- moderation queue.

Unlike the current reliance on Google reCAPTCHA, the replacement should make CAPTCHA provider choice configurable.
Yooco's research identifies Google reCAPTCHA as part of its anti-abuse setup.

---

# 34. Backups and Disaster Recovery

This is especially important because the community contains creative work.

Backups must cover:

- database,
- uploaded media,
- configuration,
- themes/plugins,
- private content.

Recommended:

- daily incremental backups,
- periodic full backups,
- geographically separate backup,
- tested restoration procedure.

**A backup that has never been restored is not considered proven.**

The community should periodically test:

> "Can we rebuild the platform from a backup on a fresh server?"

---

# 35. Data Export and Portability

This should be a first-class feature.

Every administrator should be able to export:

- users,
- profiles,
- groups,
- memberships,
- discussions,
- posts,
- files,
- stories,
- events.

At minimum:

```text
JSON
CSV
HTML / Markdown
Media archive
```

A user should be able to request an export of their personal data.

This is one of the clearest areas where the new system should improve on Yooco: the research found no documented
general-purpose import/export or public developer API.

---

# 36. Multi-community / Multitenancy

This is an optional future capability rather than an MVP requirement.

Yooco is fundamentally a multi-community/white-label platform: communities live under individual subdomains or domains
and their data is separated.

For the replacement, start with:

> **one community = one installation**

This is much simpler.

Design the architecture so that multi-tenancy is not impossible later, but do not make it a prerequisite for the first
release.

---

# 37. Internationalization

The initial language should be:

> **German**

The platform should nevertheless be built for localization.

Strings should not be hard-coded into templates.

Potential future languages:

- English
- French
- Dutch
- Spanish

Date/time and number formatting should respect locale.

---

# 38. Notifications

Notifications should be categorized rather than being one undifferentiated stream.

Example:

```text
Mentions
Replies
Quotes
Private messages
Group invitations
Group membership
Story activity
Events
Moderation
System
```

Users can configure:

```text
In-app
Email
Push
None
```

per category where technically feasible.

---

# 39. Reactions and Lightweight Social Interaction

The public forum should support lightweight reactions such as:

- Like
- Thanks
- Interesting
- Helpful

Avoid an excessive number of reaction types.

The purpose is to let members acknowledge one another without creating unnecessary short posts.

---

# 40. Optional Features for Later Releases

The following are desirable but should not block the initial release:

- public/private blogs,
- polls,
- wiki pages,
- collaborative documents,
- version comparison,
- story statistics,
- reading progress,
- writing challenges,
- badges,
- achievements,
- reputation,
- advanced calendars,
- voice/video rooms,
- mobile push notifications,
- federation / ActivityPub,
- AI-assisted tools.

The product should first make the **community + writing-group workflow** excellent.

---

# 41. Features That Should *Not* Become Priorities

Avoid rebuilding every Yooco feature just because Yooco has it.

In particular, features such as:

- virtual gifts,
- flirt systems,
- advertising marketplaces,
- elaborate gamification,

are not central to the value of this community.

Yooco includes features such as a virtual gift shop, image voting and a flirt feature.

The replacement should instead spend development effort on:

> **privacy + groups + writing + discovery + moderation + portability.**

---

# 42. MVP Scope

A realistic first release should contain:

## Accounts

- registration,
- email verification,
- login,
- password reset,
- profile.

## Public forum

- categories,
- topics,
- replies,
- search,
- moderation,
- attachments.

## Writing partners

- dedicated forum,
- tags,
- status,
- contact flow.

## Writing groups

- member-created groups,
- private groups,
- invitations,
- membership management,
- roles,
- group discussions,
- files.

## Communication

- direct messages,
- notifications.

## Administration

- users,
- roles,
- moderation,
- reports,
- settings,
- backups.

## Privacy

- privacy settings,
- account deletion,
- personal data export,
- GDPR-oriented configuration.

That is enough to replace the **core social and writing experience**.

---

# 43. Phase 2

After the MVP is proven:

- story/chapter organization,
- read-only group roles,
- events,
- richer media galleries,
- blogs,
- group chat,
- advanced search,
- writing-partner matching,
- public story publishing.

---

# 44. Phase 3

Potential longer-term features:

- mobile apps/PWA,
- real-time collaborative editing,
- story versioning,
- wiki/world-building,
- writing challenges,
- advanced analytics,
- federation,
- external API ecosystem.

---

# 45. The Most Important Product Requirement

Everything should work toward one simple promise:

> **"Meet writers here. Find somebody whose idea excites you. Create a private writing group. Write together."**

A member should be able to accomplish that without contacting an administrator.

The ideal experience should feel like:

```text
Alice
  │
  │ public discussion
  ▼
"Who wants to write this story?"
  │
  │ meets Bob
  ▼
Create Writing Group
  │
  ▼
"The Kingdom of Ash" 🔒
  │
  ├── Alice
  ├── Bob
  │
  ├── Story
  ├── Characters
  ├── World Building
  └── Planning
          │
          ▼
      Invite Carol
          │
          ▼
     Beta reader
          │
          ▼
     Finish the story
          │
          ▼
     Publish/share it
```

That workflow is the **heart of the replacement**.

Everything else — profiles, galleries, chat, blogs, events, reactions, themes — should support that experience rather
than compete with it.

---

# 46. Recommended Product Personality

If I were a current Yooco member, I would want the new platform to feel:

### Familiar

"I immediately understand where everything is."

### Warm

"It feels like our community, not a corporate collaboration tool."

### Private

"My unfinished stories are safe."

### Social

"I can discover other writers naturally."

### Flexible

"I can write one story with Alice, another with Bob, and participate casually elsewhere."

### Fast

"Pages load immediately and the site works well on my phone."

### Respectful

"There isn't unnecessary advertising or surveillance."

### Reliable

"Our stories won't disappear because a third-party service changes its business model."

### Ours

"We can choose how the community looks, where the data is hosted, and how the rules work."

### Portable

"Even if the software changes in ten years, we can take our stories and community data with us."

---

# 47. Final Product Definition

The modern Yooco replacement should therefore be understood as:

> **A self-hostable, privacy-conscious online community platform combining a traditional public forum with
member-created private writing groups.**

Its most important differentiator is not the forum itself.

It is the ability for the community's members to create **small private collaborative communities within the larger
community**.

The platform succeeds when the following statement is true:

> **Anyone can arrive as a normal community member, meet other writers, find a collaborator, create a private writing
group, invite participants, and develop a story together — while the administrators remain responsible for the health of
the community rather than manually managing every story project.**

That is the behavior I would make the central architectural requirement of the new system.
