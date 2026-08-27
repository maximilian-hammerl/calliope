import { fileURLToPath, URL } from 'node:url'

import type { Plugin } from 'vite'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'

/**
 * From the repository's own `.env`, so one file describes one checkout. The proxy target is the
 * one that matters: without it a second checkout proxies into the first one's database.
 */
const rootEnvironment = loadEnv('', fileURLToPath(new URL('..', import.meta.url)), '')

const BACKEND_PORT = Number(rootEnvironment.BACKEND_PORT ?? 8000)
const FRONTEND_PORT = Number(rootEnvironment.FRONTEND_PORT ?? 5173)
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`

/**
 * Into `process.env`, or the `%VITE_APP_NAME%` placeholder survives into the page as literal text.
 * The default cannot live in `frontend/.env`, which the repository ignores.
 */
process.env.VITE_APP_NAME ||= 'Calliope'

/**
 * Stamped by `deployment/deploy.sh` and read back off the page to prove Caddy is serving what was
 * just built. Defaulted like the name above, to the same word the compose file uses.
 */
process.env.VITE_COMMIT ||= 'unknown'

/**
 * No default on a *build*: an instance that cannot say what it is would claim to be production.
 * Serving defaults to development, so a checkout still runs with no setup.
 */
const ENVIRONMENTS = ['development', 'testing', 'staging', 'production']

/**
 * A plugin, because build and serve need opposite answers and `config` is where Vite says which is
 * running — early enough to still reach `import.meta.env`.
 */
function environment(): Plugin {
  return {
    name: 'calliope:environment',
    config(_config, { command }) {
      if (command !== 'build') {
        process.env.VITE_ENVIRONMENT ||= 'development'
        return
      }

      const value = process.env.VITE_ENVIRONMENT
      if (value === undefined || !ENVIRONMENTS.includes(value)) {
        throw new Error(
          `VITE_ENVIRONMENT must be one of ${ENVIRONMENTS.join(', ')} to build, not ${
            value === undefined ? 'unset' : `"${value}"`
          }. It comes from ENVIRONMENT in .env.`,
        )
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
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
