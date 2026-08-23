import { assertUnreachable } from '@/lib/assertUnreachable'

/**
 * Which instance this build is, baked in beside the app name for the same reason: the frontend
 * is built once per deploy, so there is no artifact promoted between environments. The build
 * refuses an invalid value (`vite.config.ts`), which is what makes the notice trustworthy.
 */
export const ENVIRONMENTS = ['development', 'testing', 'staging', 'production'] as const

export type Environment = (typeof ENVIRONMENTS)[number]

function readEnvironment(): Environment {
  const value: unknown = import.meta.env.VITE_ENVIRONMENT

  // Anything unrecognised is the least trustworthy state, never production: an instance that
  // silently claims to be production is how somebody loses what they wrote.
  return ENVIRONMENTS.includes(value as Environment) ? (value as Environment) : 'development'
}

export const ENVIRONMENT: Environment = readEnvironment()

export type EnvironmentNotice = {
  /** Uppercase, for the badge that rides along in the top bar. */
  label: string
  /** The one sentence that changes what somebody does, never a list of three. */
  sentence: string
  /** Reachable from the internet and taking registrations, so people will reuse a password. */
  publiclyReachable: boolean
}

/** Undefined on production, which is the instance that says nothing about itself. */
export function environmentNotice(environment: Environment): EnvironmentNotice | undefined {
  switch (environment) {
    case 'production':
      return undefined
    case 'development':
      return {
        label: 'Entwicklung',
        sentence: 'Entwicklungssystem. Was du hier schreibst, kann jederzeit gelöscht werden.',
        publiclyReachable: false,
      }
    case 'testing':
      return {
        label: 'Test',
        sentence: 'Testsystem. Was du hier schreibst, kann jederzeit gelöscht werden.',
        publiclyReachable: true,
      }
    // Its own world and durable, so nothing here is about losing writing. What a member needs
    // is why nothing looks familiar: they are not on the instance their groups are on.
    case 'staging':
      return {
        label: 'Vorschau',
        sentence: 'Vorschau. Deine Gruppen und Beiträge findest du hier nicht.',
        publiclyReachable: true,
      }
    default:
      return assertUnreachable(environment)
  }
}

/** Where a password is chosen or typed, and the instance is one strangers can reach. */
export const PASSWORD_REUSE_WARNING =
  'Verwende hier nicht dasselbe Passwort wie auf anderen Seiten.'
