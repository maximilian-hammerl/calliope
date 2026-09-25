/**
 * A scoped id promises that a resolver found it under its parent (`src/scope/scoped_id.ts`), and
 * the compiler cannot tell a promise kept from one written by hand. So only `src/scope/` makes
 * one — by `mint`, `resolved` or a cast — and only tests use `src/test/scope.ts`, which does the
 * same for ids a test made itself. Everyone else may name the types, never produce them.
 */

/** One name per `Scoped` alias in `scoped_id.ts`. */
const SCOPED_ID =
  /\b(GroupId|ThreadId|PostId|PageId|FolderId|StepId|MemberId)\b/;

const BACKEND = decodeURIComponent(new URL("../", import.meta.url).pathname);
const SCOPE = `${BACKEND}src/scope/`;
const TEST_SUPPORT = `${BACKEND}src/test/`;
const TEST_SCOPE = `${TEST_SUPPORT}scope.ts`;

function mayMint(file: string): boolean {
  return file.startsWith(SCOPE) || file === TEST_SCOPE;
}

function isTest(file: string): boolean {
  return file.endsWith("_test.ts") || file.startsWith(TEST_SUPPORT);
}

type ModuleReference =
  | Deno.lint.ImportDeclaration
  | Deno.lint.ExportNamedDeclaration
  | Deno.lint.ExportAllDeclaration;

/** Whether anything but types comes through: a type-only import names, it does not produce. */
function carriesValues(node: ModuleReference): boolean {
  if (node.type === "ExportAllDeclaration") {
    return node.exportKind !== "type";
  }
  if (node.type === "ExportNamedDeclaration") {
    return node.exportKind !== "type" &&
      node.specifiers.some((specifier) => specifier.exportKind !== "type");
  }
  return node.importKind !== "type" &&
    node.specifiers.some((specifier) =>
      specifier.type !== "ImportSpecifier" || specifier.importKind !== "type"
    );
}

const plugin: Deno.lint.Plugin = {
  name: "calliope",
  rules: {
    "scoped-ids": {
      create(context) {
        const file = context.filename;

        const checkModule = (node: ModuleReference) => {
          const source = node.source?.value ?? "";
          if (
            source.endsWith("/scope/scoped_id.ts") && !mayMint(file) &&
            carriesValues(node)
          ) {
            context.report({
              node,
              message: "Only `src/scope/` makes a scoped id",
              hint:
                "Take the id from the route's resolver, or from `folderOf`/`forumFolderOf`; import the types with `import type`.",
            });
          }
          if (source.endsWith("/test/scope.ts") && !isTest(file)) {
            context.report({
              node,
              message: "`src/test/scope.ts` is for tests",
              hint: "Shipping code takes its scoped ids from a resolver.",
            });
          }
        };

        const checkCast = (
          node: Deno.lint.TSAsExpression | Deno.lint.TSTypeAssertion,
        ) => {
          if (
            !file.startsWith(SCOPE) &&
            SCOPED_ID.test(context.sourceCode.getText(node.typeAnnotation))
          ) {
            context.report({
              node,
              message: "A cast to a scoped id skips its resolver",
              hint:
                "List the resolver in the route's middleware and read the id from `c.get(…)`.",
            });
          }
        };

        return {
          ImportDeclaration: checkModule,
          ExportNamedDeclaration: checkModule,
          ExportAllDeclaration: checkModule,
          TSAsExpression: checkCast,
          TSTypeAssertion: checkCast,
        };
      },
    },
  },
};

export default plugin;
