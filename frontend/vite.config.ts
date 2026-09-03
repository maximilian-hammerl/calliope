import { fileURLToPath, URL } from 'node:url'

import type { Plugin } from 'vite'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'

/** The repository's own `.env`, so one file describes one checkout — see `envDir` below. */
const ROOT = fileURLToPath(new URL('..', import.meta.url))

/** Unprefixed: these configure the dev server, not the page. Without the proxy target a second
 * checkout proxies into the first's database. */
const rootEnvironment = loadEnv('', ROOT, '')

const BACKEND_PORT = Number(rootEnvironment.BACKEND_PORT ?? 8000)
const FRONTEND_PORT = Number(rootEnvironment.FRONTEND_PORT ?? 5173)
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`

/** Defaulted for a build too: neither says anything an instance could get wrong. */
const OPTIONAL_ENVIRONMENT = {
  PUBLIC_APP_NAME: 'Calliope',
  PUBLIC_GIT_COMMIT: 'unknown',
} as const

/** Placeholders for serving only; a build refuses rather than ship one. */
const REQUIRED_ENVIRONMENT = {
  PUBLIC_WEBSITE_OPERATOR_NAME: 'Platzhalter-Vorname Platzhalter-Nachname',
  PUBLIC_WEBSITE_OPERATOR_EMAIL_ADDRESS: 'platzhalter@e-mail-adresse.de',
  // Named in the privacy policy, which reads badly with nobody after „Wir setzen ein:".
  PUBLIC_HOSTER_NAME: 'Platzhalter-Hoster',
} as const

/**
 * No default on a *build*: an instance that cannot say what it is would claim to be production.
 * Serving defaults to development, so a checkout still runs with no setup.
 */
const ENVIRONMENTS = ['development', 'testing', 'staging', 'production']

/** What was defaulted. In `process.env` because a `.env` edit re-imports this file, which would
 * forget a module variable while its stale value went on outranking the file. */
const DEFAULTED = 'CALLIOPE_DEFAULTED_ENVIRONMENT'

/**
 * A plugin, because build and serve need opposite answers and `config` is where Vite says which is
 * running — early enough to still reach `import.meta.env`.
 */
function environment(): Plugin {
  return {
    name: 'calliope:environment',
    config(_config, { command, mode }) {
      for (const name of (process.env[DEFAULTED] ?? '').split(',').filter(Boolean)) {
        delete process.env[name]
      }
      delete process.env[DEFAULTED]

      // What the page will get: `.env` merged with whatever a deploy hands in.
      const configured = loadEnv(mode, ROOT, 'PUBLIC_')
      const unset = (name: string) => (configured[name] ?? '').trim() === ''
      const defaulted = new Set<string>()
      const fallBackTo = (name: string, value: string) => {
        process.env[name] = value
        defaulted.add(name)
        process.env[DEFAULTED] = [...defaulted].join(',')
      }

      for (const [name, value] of Object.entries(OPTIONAL_ENVIRONMENT)) {
        if (unset(name)) {
          fallBackTo(name, value)
        }
      }

      if (command !== 'build') {
        if (unset('PUBLIC_ENVIRONMENT')) {
          fallBackTo('PUBLIC_ENVIRONMENT', 'development')
        }
        // Obvious placeholders, so nobody mistakes one for configuration.
        for (const [name, placeholder] of Object.entries(REQUIRED_ENVIRONMENT)) {
          if (unset(name)) {
            fallBackTo(name, placeholder)
          }
        }
        return
      }

      const value = configured.PUBLIC_ENVIRONMENT
      if (value === undefined || !ENVIRONMENTS.includes(value)) {
        throw new Error(
          `PUBLIC_ENVIRONMENT must be one of ${ENVIRONMENTS.join(', ')} to build, not ${
            value === undefined ? 'unset' : `"${value}"`
          }.`,
        )
      }

      // A page saying "not configured" must never reach production.
      const missing = Object.keys(REQUIRED_ENVIRONMENT).filter(unset)
      if (missing.length > 0) {
        throw new Error(
          `${missing.join(', ')} must be set to build: the legal pages cannot name nobody.`,
        )
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // The repository's `.env`, the same file the backend and the compose files read.
  envDir: ROOT,

  // The whole rule: `PUBLIC_` reaches the browser, anything else cannot. Nothing to keep in step
  // when a variable is added, which is why the backend's shared three carry the prefix too.
  envPrefix: ['PUBLIC_'],

  plugins: [environment(), vue(), vueDevTools(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // Strict: drifting onto a free port is how proxying into the wrong backend goes unnoticed.
    port: FRONTEND_PORT,
    strictPort: true,

    // Mirrors production's `img-src`, because an image blocked by policy is invisible until a
    // deploy. Only that directive: HMR needs inline scripts, `eval` and a websocket.
    headers: {
      'Content-Security-Policy': "img-src 'self' data: blob:",
    },

    // Same-origin like production behind Caddy: relative URLs, no CORS, and the httpOnly cookie
    // sent without configuration. One rule, because the backend serves everything under /api.
    proxy: {
      '/api': BACKEND_URL,
    },
  },
})
