import { fileURLToPath, URL } from 'node:url'

import type { Plugin } from 'vite'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'

/** Where `deno task dev` serves the backend; `deno serve` defaults to port 8000. */
const BACKEND_URL = 'http://localhost:8000'

/**
 * Assigning back into `process.env` rather than only using the constant is deliberate: Vite
 * exposes `VITE_`-prefixed variables to both `import.meta.env` and the `%VITE_APP_NAME%`
 * placeholder in index.html, and an undefined one leaves that placeholder in the page as
 * literal text. Setting it here means the substitution always happens, whether or not an
 * operator supplied a name.
 *
 * A committed default cannot live in `frontend/.env` — the repository ignores `.env`.
 */
process.env.VITE_APP_NAME ||= 'Calliope'

/**
 * The build this bundle came from, stamped by `deployment/deploy.sh` and read back off the
 * served page to prove Caddy is serving what the deploy just built. Defaulted for the same
 * reason as the name above, and to the same word the compose file falls back to.
 */
process.env.VITE_COMMIT ||= 'unknown'

/**
 * Which instance the bundle is for. Unlike the name above it has no default on a build: an
 * instance that cannot say what it is would claim to be production, and somebody would lose
 * writing to it. Serving defaults to development, so a checkout still runs with no setup.
 */
const ENVIRONMENTS = ['development', 'testing', 'staging', 'production']

/**
 * A plugin rather than a line beside the name above, because the two commands need opposite
 * answers and `config` is where Vite says which one is running — early enough that what it
 * sets still reaches `import.meta.env`.
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
    // Keeps development same-origin, exactly like production behind Caddy: the generated
    // client can use relative URLs, no CORS preflight happens, and the httpOnly session
    // cookie is sent without any credentials configuration. The backend serves everything
    // under /api, so no route can be missed here.
    proxy: {
      '/api': BACKEND_URL,
    },
  },
})
