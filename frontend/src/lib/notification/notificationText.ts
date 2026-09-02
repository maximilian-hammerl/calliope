import type { ListNotifications200ResultsItem } from '@/api/models'
import type { RouteLocationRaw } from 'vue-router'
import { assertUnreachable } from '@/lib/assertUnreachable'

/**
 * A notification is stored as the event, never as the sentence, so the sentence is written
 * here. Group and thread titles come from the response, joined at read time, which is why a
 * renamed group reads correctly in an old notification.
 */

/**
 * What the role lets you do, as a clause. The member list's labels („Admin", „Schreibt",
 * „Liest") are column headings and read badly mid-sentence — „geändert: Liest." Verbs also
 * keep this neutral, where a noun would force a guess at somebody's gender.
 */
const ROLE_CLAUSES: Record<string, string> = {
  administrator: 'Du verwaltest die Gruppe.',
  writer: 'Du schreibst mit.',
  reader: 'Du liest mit.',
}

/** The writing survives the account, so a notification about it has to as well. */
function actorOf(notification: ListNotifications200ResultsItem): string {
  return notification.actorUsername ?? 'Gelöschtes Konto'
}

export function notificationText(notification: ListNotifications200ResultsItem): string {
  const actor = actorOf(notification)

  // Narrowed by `type`, so each sentence can only reach for what its own kind carries.
  switch (notification.type) {
    case 'invited_to_writing_group':
      return `${actor} hat dich zu „${notification.writingGroupTitle}“ eingeladen.`
    case 'invitation_accepted':
      return `${actor} ist „${notification.writingGroupTitle}“ beigetreten.`
    case 'visibility_changed_in_writing_group':
      // Named plainly, because it changes who can read what everybody has written.
      return notification.visibility === 'public'
        ? `${actor} hat „${notification.writingGroupTitle}“ öffentlich gemacht. Alle können jetzt mitlesen.`
        : `${actor} hat „${notification.writingGroupTitle}“ auf privat gestellt. Nur Mitglieder können mitlesen.`
    case 'role_changed_in_writing_group':
      return `${actor} hat deine Rolle in „${notification.writingGroupTitle}“ geändert: ${
        ROLE_CLAUSES[notification.role] ?? notification.role
      }`
    case 'new_writing_thread':
      return `${actor} hat das Thema „${notification.writingThreadTitle}“ in „${notification.writingGroupTitle}“ angelegt.`
    case 'new_writing_post':
      // Both names: somebody in several groups cannot place a thread title on its own.
      return `${actor} hat in „${notification.writingThreadTitle}“ in „${notification.writingGroupTitle}“ geschrieben.`
    case 'new_writing_page':
      return `${actor} hat die Seite „${notification.writingPageTitle}“ in „${notification.writingGroupTitle}“ angelegt.`
    case 'invited_to_chat_group':
      // The two invitations are different things and land in different places.
      return `${actor} hat dich zum Chat „${notification.chatGroupTitle}“ eingeladen.`
    default:
      return assertUnreachable(notification)
  }
}

/**
 * Where the notification takes you. Not a route in every case: a chat lives in the Chats
 * dialog rather than at a URL, so this is a verdict the caller acts on rather than something
 * that can be handed to `RouterLink`.
 */
export type NotificationAction =
  | { kind: 'route'; to: RouteLocationRaw }
  | { kind: 'chat'; chatGroupId: string }

export function notificationAction(
  notification: ListNotifications200ResultsItem,
): NotificationAction {
  switch (notification.type) {
    case 'new_writing_thread':
    case 'new_writing_post':
      return {
        kind: 'route',
        to: {
          name: 'thread',
          params: {
            groupId: notification.writingGroupId,
            threadId: notification.writingThreadId,
          },
        },
      }
    case 'new_writing_page':
      return {
        kind: 'route',
        to: {
          name: 'page',
          params: {
            groupId: notification.writingGroupId,
            pageId: notification.writingPageId,
          },
        },
      }
    case 'invited_to_writing_group':
    case 'invitation_accepted':
    case 'visibility_changed_in_writing_group':
    case 'role_changed_in_writing_group':
      // An invitation lands on the group page, which is where accepting it lives.
      return {
        kind: 'route',
        to: { name: 'group', params: { groupId: notification.writingGroupId } },
      }
    case 'invited_to_chat_group':
      return { kind: 'chat', chatGroupId: notification.chatGroupId }
    default:
      // A new notification type reaches here as a compile error, not a silent fallthrough to
      // some group page that may not be what it was about.
      return assertUnreachable(notification)
  }
}
