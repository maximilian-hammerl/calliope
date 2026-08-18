import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'

/** Where `deno task dev` serves the backend; `deno serve` defaults to port 8000. */
const BACKEND_URL = 'http://localhost:8000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), vueDevTools(), tailwindcss()],
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
