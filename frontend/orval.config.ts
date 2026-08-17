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
    },
  },
});
