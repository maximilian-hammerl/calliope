---
paths:
  - "frontend/src/components/notification/**"
  - "frontend/src/lib/notification/**"
---

# Notifications

`lib/notification/notificationText.ts` writes the sentence; the API returns the event and the joined
titles, never a rendered string — a renamed group reads correctly in an old notification, and
nothing survives the reader losing access to what it is about. Same rule as `sessionDevice.ts`.

`NotificationsDialog` marks everything read on open and invalidates **only** the current-user query,
never its own list: that clears the mark on the avatar while the dialog keeps showing what was new
when it was opened. Its query is `enabled` on the dialog being open — it lives in the top bar on
every page.

Personal features are dialogs opened from the avatar menu rather than routes, so they do not take a
member off the page they are on.
