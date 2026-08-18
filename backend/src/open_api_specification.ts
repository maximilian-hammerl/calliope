import type { OpenAPIObject } from "openapi3-ts/oas31";
import { getRequiredEnvVariable } from "./util/env.ts";

export const API_TITLE = "Calliope";
export const API_VERSION = "0.1.0";

export const OPERATIONS_TAG = "operations";
export const AUTH_TAG = "auth";
export const GROUPS_TAG = "groups";
export const MEMBERSHIPS_TAG = "memberships";
export const THREADS_TAG = "threads";
export const POSTS_TAG = "posts";
export const USERS_TAG = "users";
export const NOTIFICATIONS_TAG = "notifications";
export const CHATS_TAG = "chats";

type Tag =
  | typeof OPERATIONS_TAG
  | typeof AUTH_TAG
  | typeof GROUPS_TAG
  | typeof MEMBERSHIPS_TAG
  | typeof THREADS_TAG
  | typeof POSTS_TAG
  | typeof USERS_TAG
  | typeof NOTIFICATIONS_TAG
  | typeof CHATS_TAG;

// Type safe tags to descriptions mapping, so there cannot be new tags without descriptions
const TAGS_WITH_DESCRIPTIONS: Record<Tag, string> = {
  [OPERATIONS_TAG]:
    "Liveness of the application and the databases it depends on",

  [AUTH_TAG]: "Registration, sessions and sign-out",

  [GROUPS_TAG]: "Managing writing groups and their visibility",
  [MEMBERSHIPS_TAG]:
    "Managing who belongs to a writing group, in which role, and their invitations",

  [THREADS_TAG]: "Managing the threads of a writing group",
  [POSTS_TAG]: "Managing the posts of a thread, published or draft",
  [USERS_TAG]:
    "Finding other members by name, so they can be invited to a group",
  [CHATS_TAG]: "Chats between members, and the messages in them",
  [NOTIFICATIONS_TAG]:
    "What happened to a member: invitations, role changes, and activity in their groups",
};

export default {
  openapi: "3.1.0",
  info: {
    title: API_TITLE,
    version: API_VERSION,
    description: "The API of Calliope, a community of private writing groups.",
    contact: {
      name: "Maximilian Hammerl",
      email: "maximilian@hammerl.dev",
    },
  },
  servers: [{ url: getRequiredEnvVariable("HOST_URL") }],
  tags: Object.entries(TAGS_WITH_DESCRIPTIONS).map(([name, description]) => ({
    name,
    description,
  })),
} satisfies OpenAPIObject;
