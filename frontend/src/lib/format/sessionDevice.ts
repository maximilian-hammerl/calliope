/** Names a session's device out of the parts the API sends, since the German belongs here. */
import type { ListSessions200ResultsItem } from '@/api/models'
import { capitalize } from '@/lib/format/formatText'

/** A kind with no word here is left off rather than guessed at. */
const DEVICE_TYPE_WORD: Record<string, string | undefined> = {
  mobile: 'Handy',
  tablet: 'Tablet',
  console: 'Spielekonsole',
  smarttv: 'Fernseher',
}

type SessionDevice = Pick<
  ListSessions200ResultsItem,
  'browser' | 'operatingSystem' | 'deviceType' | 'vendor'
>

function sessionPlatform(session: SessionDevice): string | null {
  if (session.browser) {
    if (session.operatingSystem) {
      return `${session.browser} auf ${session.operatingSystem}`
    }
    return session.browser
  }
  if (session.operatingSystem) {
    return session.operatingSystem
  }
  return null
}

function sessionDeviceKind(session: SessionDevice): string | null {
  if (!session.deviceType) {
    return null
  }
  return DEVICE_TYPE_WORD[session.deviceType] ?? capitalize(session.deviceType)
}

export function sessionDevice(session: SessionDevice): string {
  const platform = sessionPlatform(session)

  // The brand carries the recognition: "iOS" says nothing to a member who knows Apple. It is
  // the one part the parser never fills with a placeholder, so it can be shown as it comes.
  const device = [session.vendor, sessionDeviceKind(session)].filter(Boolean).join(' ')

  if (platform) {
    if (device) {
      return `${platform} · ${device}`
    }
    return platform
  }
  if (device) {
    return device
  }
  return 'Unbekanntes Gerät'
}
