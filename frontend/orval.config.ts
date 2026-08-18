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
        // The list endpoints use the HTTP QUERY method, and Orval classifies anything that
        // is not GET as a mutation — which would mean no caching, no query key and no fetch
        // on mount. They are reads, so they are generated as queries.
        operations: {
          listGroups: { query: { useQuery: true } },
          listThreads: { query: { useQuery: true } },
          listPosts: { query: { useQuery: true } },
          listMemberships: { query: { useQuery: true } },
        listUsers: { query: { useQuery: true } },
        },
        // The generated client resolves for every status, so vue-query would see a 401 as a
        // success. The mutator throws instead. It lives outside src/api because that whole
        // directory is generated and git-ignored.
        mutator: {
          path: 'src/lib/apiFetch.ts',
          name: 'apiFetch',
        },
      },
    },
  },
});
