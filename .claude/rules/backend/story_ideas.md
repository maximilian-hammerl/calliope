---
paths:
  - "backend/src/route/story_ideas/**"
  - "backend/src/service/story_idea_service.ts"
  - "backend/src/query/story_vocabulary.ts"
  - "backend/src/story_metadata.ts"
  - "backend/src/http/story_metadata_refusal.ts"
---

# Story ideas

## The carousel walks by id, not by offset

`QUERY /story-ideas/carousel` answers with one idea and the two either side of it, plus how many
the set holds. The set is the view's own — open ideas the member has not read and did not write,
no blocked authors — so it takes no filters.

- **Neighbours are found by id.** Ids are uuidv7, so comparing them is creation order and each
  neighbour is one primary-key scan. An offset would be wrong the moment anybody posted an idea.
- **One filter chain, `filtered()`, shared with `listStoryIdeas`.** A neighbour the carousel offers
  but the board hides is an idea nobody can reach twice.
- **Unanchored, there is no previous**: the endpoint chose the newest, so no second statement is
  asked. Asking read a second snapshot in which a just-posted idea was suddenly the previous one —
  that made the opening step's backward arrow flicker and the test flaky.
- **The anchor ignores read state, and only that.** Marking the idea on screen as read must not
  invalidate the URL the member is on. Their own idea, a closed one, or a blocked author's answers 404.
- **An empty set is not an error**: nulls and a total of zero.

`total` counts the set, not the member's position; the position would cost a count per step.

## An idea is written twice

`teaser` and `synopsis` are the only two mandatory prose fields anywhere; everything else about an
idea is optional on purpose. The synopsis becomes the group's under the same name — which is why
`writing_group.blurb` was renamed `synopsis`. `search` matches either.

## The vocabularies

`genres`, `subgenres`, `tropes` and `content_warnings` are Postgres enums today (#121 makes them
tables). `SUBGENRE_GENRE` in `story_metadata.ts` places every subgenre under a genre with `satisfies`
over the generated enums, so an unplaced value fails to compile. `refuseOrphanedSubgenres` is
checked against the **resulting row**, not the request — a PATCH of `{"genres": ["western"]}` alone
orphans a stored `dark_fantasy`, which no rule on the body can see. It throws `HTTPException` in the
`defaultHook`'s 400 shape, so one kind of refusal reaches the client. `updateStoryIdea` locks the
row `FOR UPDATE` first: at READ COMMITTED two PATCHes racing could each pass and commit the pair.

`STORY_TAGS_SCHEMA` is `.optional()`, never `.default([])`: a default materialises the field when
the client omitted it, and every partial update silently cleared the tags. Normalisation lives in
`toRow` — trimmed, blanks dropped, repeats removed case-insensitively — so a caller cannot skip it,
and a transform in the schema would put something in `open-api.json` the client cannot see.
