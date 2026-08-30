import { BreachedPasswordService } from "@/src/service/breached_password_service.ts";

/**
 * No test asks Have I Been Pwned. Imported by both fixture modules rather than set per file, and
 * a test that wants a refusal replaces the method for itself with `stub`.
 */
BreachedPasswordService.isBreached = () => Promise.resolve(false);
