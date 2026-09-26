---
name: mirror-story
description: Mirror a GitHub story to the community forum at discourse.hammerl.dev — create its topic, move it between categories, or move its card on the board. Run whenever a user or admin story is created, gets, changes or loses a milestone, or is closed or reopened.
user-invocable: true
---

User and admin stories live twice: the GitHub issue says how, a Discourse topic tells members what
and why. A story is an issue labelled `type: user story` or `type: admin story`; everything else,
tasks and bugs included, stays on GitHub only. `$ARGUMENTS` names the issue, e.g. `#95`.

**Access.** The forum is `https://discourse.hammerl.dev`; every path below is relative to it. Ask
the human for the path of the file holding the admin API key and for the Discourse username to act
as, and send them as `Api-Key` and `Api-Username`. Never ask for the key itself: pasted into the chat,
it ends up in the transcript. Read it inside the command, `-H "Api-Key: $(cat <path>)"`, so it never
appears as text; never print it, never write it into the repository. Without a key file, change
nothing: tell the human which topic and card need what.

## Where a story goes

| GitHub | Category (id) | Board (id): column ids |
|---|---|---|
| milestone `v1` | Für den Umzug (7) | calliope-v1 (1): Offen 1, In Bearbeitung 2, In Prüfung 3, Erledigt 4 |
| milestone `v2` | Nach dem Umzug (8) | calliope-v2 (2): Offen 5, In Bearbeitung 6, In Prüfung 7, Erledigt 8 |
| no milestone, `status: proposed` | Ideen & Wünsche (6) | none; members vote there instead |
| anything else | none | none |

A new story's card goes to Offen; In Bearbeitung is the human's to set. In Prüfung means the story
is deployed to the test instance and members are trying it out: if they find a problem, the issue
is reopened or a new one filed; if not, the testers move the card to Erledigt themselves. A board
accepts only topics from its own category.

## What each change needs

- **New story:** create the topic, then its card.
- **Milestone set or changed:** move the topic to the new category first, then delete the card from
  the old board and create it on the new one. The old card may already be gone once its topic left
  the board's category; that is not an error.
- **Milestone removed, `status: proposed` set:** move the topic to Ideen & Wünsche and delete the
  card.
- **Milestone removed, no label:** treat it as closed as not planned.
- **Closed as completed:** ask the human whether the card goes to In Prüfung or straight to
  Erledigt, and rewrite the first post in the present tense. The topic stays open for replies.
- **Reopened:** move the card to In Bearbeitung.
- **Closed as not planned:** delete the card, reply to the topic with one German sentence saying
  that it will not be built and why, taken from the issue, then close the topic.

## How a topic reads

Read the issue first (`gh issue view <number>`) and write only what it decides. German, informal
Du, in Calliope's own terms (Thread, Beitrag, Storyidee, Schreibgruppe). A title of at least 15
characters; two plain sentences for members, no code or file names — the future tense while the
story is open („Künftig kannst du …"), the present once it is done („Du kannst jetzt …"). Then
exactly this line, which is also how the topic is found again:

```
Die technischen Details stehen in [#95 auf GitHub](https://github.com/maximilian-hammerl/calliope/issues/95).
```

Exactly one epic tag: `schreiben`, `schreibgruppen`, `storyideen`, `forum`, `chat`, `profil`,
`konto`, `darstellung` or `moderation`. Admin stories are `moderation`. If none fits, ask the human
rather than create a tenth.

Discourse refuses some titles with a 422, as too similar to another or as unclear. Read the error
and rephrase; do not retry the same title.

## Finding a story's topic

Search for the phrase, `GET /search.json?q="#95 auf GitHub"`, then confirm with
`GET /raw/<topic_id>` that the post links `issues/95)`. Search drops one-digit numbers, so for #1 to
#9 list the three categories (`GET /c/<id>.json`, which redirects to the slugged URL) and check each
topic's raw post instead.

## Endpoints

- Topic: `POST /posts.json` with `title`, `raw`, `category`, `tags`; move it with
  `PUT /t/-/<topic_id>.json` and `category_id`. Reply with `POST /posts.json` and `topic_id`, `raw`;
  close with `PUT /t/<topic_id>/status` and `status=closed`, `enabled=true`.
- First post: its id is `post_stream.posts[0].id` in `GET /t/<topic_id>.json`; rewrite it with
  `PUT /posts/<post_id>.json` and `{"post":{"raw":…}}`.
- Cards: `GET /boards/api/boards/<board>.json` lists them with their `topic_id`;
  `POST /boards/api/boards/<board>/cards.json` with `{"card":{"topic_id":…,"column_id":…}}`;
  `PUT …/cards/<card_id>.json` with `{"card":{"column_id":…}}` to move;
  `DELETE …/cards/<card_id>.json` to remove.

The admin API allows 60 requests a minute; on 429, wait for `Retry-After`. Finish by reading the
result back without the key — the board, or for Ideen & Wünsche the topic — and report the topic URL
and, where there is one, the card's column.
