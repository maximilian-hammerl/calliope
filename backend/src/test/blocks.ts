import { request } from "@/src/test/support.ts";

export const blocker = "block-test-blocker";
export const blocked = "block-test-blocked";

export const blockMember = (cookie: string, userId: string) =>
  request("POST", "/api/blocks", cookie, { userId });

export const unblockMember = (cookie: string, userId: string) =>
  request("DELETE", `/api/blocks/${userId}`, cookie);

export const listBlocks = (cookie: string) =>
  request("QUERY", "/api/blocks", cookie, {});
