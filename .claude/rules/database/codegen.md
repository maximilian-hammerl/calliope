---
paths:
  - "database/.kysely-codegenrc.ts"
  - "database/kysely_zod_serializer.ts"
  - "backend/src/database/schema.ts"
---

# The generated types

`kysely_zod_serializer.ts` emits both the Kysely types and the Zod schemas into
`backend/src/database/schema.ts`. Column comments become `.describe()`; enum values and comments are
escaped through `JSON.stringify`, so an apostrophe cannot break the file. Its output is not
`deno fmt`-clean — format the backend after generating.

**`json` and `jsonb` map to `unknown`** in `typeMapping`, not to kysely-codegen's own `Json`. That
type is a recursive union, and a recursive type in a route's response exhausts TypeScript's
instantiation budget: `@hono/zod-openapi` fails with **TS2589**, naming neither the column nor the
route, and because the budget is global the route it lands on moves as unrelated code changes.
`unknown` makes the reader say what the column holds — `writing_post.document` is validated by
`document_schema.ts` and selected through `$castTo<PostDocument>()`, the one line of ceremony.
`columnOverrides` is the per-column escape hatch; prefer `typeMapping` where the rule is about the
type, since an override has to be remembered for every future column.

`outFile` is `"../backend/src/database/schema.ts"` — move that directory and the generator silently
rebuilds the old path.
