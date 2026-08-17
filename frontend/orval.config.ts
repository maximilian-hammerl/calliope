import { defineConfig } from 'orval';

export default defineConfig({
  calliope: {
    input: {
      target: '../backend/open-api.json',
    },

    output: {
      client: 'vue-query',
      httpClient: 'fetch',

      mode: 'tags-split',

      target: 'src/api/calliope.ts',
      schemas: 'src/api/models',

      override: {
        // The generated client resolves for every status, so vue-query would see a 401 as a
        // success. The mutator throws instead. It lives outside src/api because that whole
        // directory is generated and git-ignored.
        mutator: {
          path: 'src/lib/api_fetch.ts',
          name: 'apiFetch',
        },
      },
    },
  },
});
