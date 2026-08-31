import { assertEquals } from "@std/assert";
// Imported rather than read: a module load needs no file permission, and the test
// task runs under the same restricted set the application does.
import document from "@/open-api.json" with { type: "json" };

/**
 * Text a request must supply has to say something, not merely be long enough. `min(1)` counts
 * characters, so „   " passes it — and a group could be founded with no title, a thread renamed
 * to nothing, a member registered under a name that renders as blank everywhere it appears.
 *
 * Read off `open-api.json` rather than the schemas, because that is where every route's body ends
 * up whatever shape it was declared in, and because a rule the document does not carry is one a
 * client cannot see. `notBlank` emits `pattern`, so a field without one has not been through it.
 *
 * The exceptions are named rather than skipped, and named by operation *and* field: `password`
 * alone would exempt every future field anybody calls that, on any route. Each entry below is a
 * place where whitespace is legitimate, and a sixteenth has to be added deliberately.
 */
const WHITESPACE_IS_LEGITIMATE = new Set([
  // A space belongs to a password; trimming or refusing one would lock somebody out of an
  // account whose password is spaces at either end. `util/password.ts` never trims.
  "loginUser.password",
  "registerUser.password",
  "changePassword.currentPassword",
  "changePassword.newPassword",
  "resetPassword.password",
  "requestAccountDeletion.password",
  "requestEmailAddressChange.password",
  // Opaque `id.secret` from a mailed link. `parseToken` answers undefined for anything malformed,
  // so a blank one is already an unknown token rather than a stored value.
  "verifyEmailAddress.token",
  "resetPassword.token",
  "confirmEmailAddressChange.token",
  "cancelEmailAddressChange.token",
  "confirmAccountDeletion.token",
  // A username *or* an address, so neither format applies — and it is looked up, never stored.
  "loginUser.login",
  "requestPasswordReset.login",
]);

type Schema = {
  type?: string;
  minLength?: number;
  pattern?: string;
  properties?: Record<string, Schema>;
  allOf?: Schema[];
  anyOf?: Schema[];
  oneOf?: Schema[];
};

function requiredTextWithoutAPattern(
  schema: Schema,
  operationId: string,
  found: Set<string>,
): void {
  for (const branch of [schema.allOf, schema.anyOf, schema.oneOf].flat()) {
    if (branch !== undefined) {
      requiredTextWithoutAPattern(branch, operationId, found);
    }
  }

  for (const [name, property] of Object.entries(schema.properties ?? {})) {
    if (
      property.type === "string" &&
      (property.minLength ?? 0) >= 1 &&
      property.pattern === undefined
    ) {
      found.add(`${operationId}.${name}`);
    }
  }
}

Deno.test("every text a request must supply refuses whitespace alone", () => {
  const found = new Set<string>();

  for (const operations of Object.values(document.paths)) {
    for (const operation of Object.values(operations)) {
      const schema = (operation as {
        requestBody?: {
          content?: { "application/json"?: { schema?: Schema } };
        };
      })?.requestBody?.content?.["application/json"]?.schema;

      if (schema !== undefined) {
        requiredTextWithoutAPattern(
          schema,
          (operation as { operationId?: string }).operationId ?? "?",
          found,
        );
      }
    }
  }

  const unguarded = [...found]
    .filter((name) => !WHITESPACE_IS_LEGITIMATE.has(name))
    .toSorted();

  assertEquals(
    unguarded,
    [],
    `these accept whitespace alone; wrap them in notBlank(): ${
      unguarded.join(", ")
    }`,
  );
});
