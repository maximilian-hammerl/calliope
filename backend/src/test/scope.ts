import { mint } from "@/src/scope/scoped_id.ts";

/**
 * A test that calls a service directly made its ids itself, so it scopes them itself — the
 * type is taken from where the id goes. Nothing that ships imports this (`lint/scoped_ids.ts`).
 */
export const scoped = mint;
