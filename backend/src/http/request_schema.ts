import { z } from "@hono/zod-openapi";
import { TEXT_LIMIT } from "@/src/text_limit.ts";

/**
 * The one definition of an acceptable email address. Every route that takes one uses this,
 * because the `pattern` is easy to leave off and nothing would notice: Zod's default is
 * *stricter* than the browser's, so an address the form accepted would be refused by the API
 * with no explanation the member could act on.
 *
 * The HTML5 pattern is what browsers apply to `input[type=email]`, so the form and the schema
 * agree exactly. It is deliberately permissive — `a@b` and `alice@localhost` pass — which is
 * the price of that agreement.
 *
 * Lower-cased on the way in, so the UNIQUE constraint cannot be sidestepped by changing case.
 */
export const EMAIL_ADDRESS_SCHEMA = z.email({ pattern: z.regexes.html5Email })
  .max(TEXT_LIMIT.emailAddress)
  .toLowerCase();
