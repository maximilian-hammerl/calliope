---
paths:
  - "backend/src/route/chats/**"
  - "backend/src/service/chat_*_service.ts"
  - "backend/src/service/user_in_chat_group_service.ts"
  - "backend/src/event/**"
---

# Chats

**Fan-out is in process** (`event/chat_events.ts`), which is correct while the backend is exactly
one container and fails *silently* with a second: a member on one instance never sees a message sent
through the other. Swapping the two functions there for Redis pub/sub is the fix.

The stream (`route/chats/chat_events_stream.ts`) is a plain Hono route, not an OpenAPI one: an
endless `text/event-stream` cannot be described by `createRoute`. Three things keep it alive — a
heartbeat, `flush_interval -1` in the Caddyfile, and closing open streams on the shutdown signal so
a deploy does not hang.

History pages by **cursor**, not offset: messages arrive while somebody reads. Ids are uuidv7, so
one index orders the conversation.

`ChatGroupGate` exists beside the full read because `checkJoinedChatMember` runs on every message
sent, and it was counting unread messages each time only to throw the number away.
