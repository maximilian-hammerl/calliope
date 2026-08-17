import { defineConfig } from 'orval';

export default defineConfig({
  calliope: {
    input: {
      target: '../backend/open-api.json',
    },

    output: {
      mode: 'tags-split',
      target: 'src/api/calliope.ts',
      schemas: 'src/api/model',
    },
  },
});
