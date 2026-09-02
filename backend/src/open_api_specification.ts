import type { OpenAPIObject } from "openapi3-ts/oas31";
import { getRequiredEnvVariable } from "./util/env.ts";
import { APP_CONTACT, APP_DESCRIPTION, APP_NAME } from "@/src/branding.ts";

export const API_VERSION = "0.1.0";

export const OPERATIONS_TAG = "operations";
export const AUTH_TAG = "auth";
export const GROUPS_TAG = "groups";
export const MEMBERSHIPS_TAG = "memberships";
export const THREADS_TAG = "threads";
export const STEPS_TAG = "steps";
export const PAGES_TAG = "pages";
export const POSTS_TAG = "posts";
export const USERS_TAG = "users";
export const NOTIFICATIONS_TAG = "notifications";
export const SEARCH_TAG = "search";
export const CHATS_TAG = "chats";
export const STORY_IDEAS_TAG = "story-ideas";
export const BLOCKS_TAG = "blocks";
export const REPORTS_TAG = "reports";
export const FAVOURITES_TAG = "favourites";

type Tag =
  | typeof OPERATIONS_TAG
  | typeof AUTH_TAG
  | typeof GROUPS_TAG
  | typeof MEMBERSHIPS_TAG
  | typeof THREADS_TAG
  | typeof STEPS_TAG
  | typeof PAGES_TAG
  | typeof POSTS_TAG
  | typeof USERS_TAG
  | typeof NOTIFICATIONS_TAG
  | typeof CHATS_TAG
  | typeof STORY_IDEAS_TAG
  | typeof BLOCKS_TAG
  | typeof REPORTS_TAG
  | typeof FAVOURITES_TAG
  | typeof SEARCH_TAG;

// Type safe tags to descriptions mapping, so there cannot be new tags without descriptions
const TAGS_WITH_DESCRIPTIONS: Record<Tag, string> = {
  [OPERATIONS_TAG]:
    "Liveness of the application and the databases it depends on",

  [AUTH_TAG]: "Registration, sessions and sign-out",

  [GROUPS_TAG]: "Managing writing groups and their visibility",
  [STORY_IDEAS_TAG]:
    "The public board of story ideas seeking writers, and their lifecycle",
  [BLOCKS_TAG]:
    "Refusing contact from another member, and the list of who is refused",
  [REPORTS_TAG]:
    "Reporting something to the operators, with the reason it is being reported",
  [FAVOURITES_TAG]:
    "A member's own favourites, across groups, threads, posts, story ideas and chats",
  [MEMBERSHIPS_TAG]:
    "Managing who belongs to a writing group, in which role, and their invitations",

  [THREADS_TAG]: "Managing the threads of a writing group",
  [STEPS_TAG]:
    "The next steps a group has agreed on, ticked off as the story gets there",
  [POSTS_TAG]: "Managing the posts of a thread, published or draft",
  [PAGES_TAG]:
    "A group's reference pages: material that is written and revised rather than replied to",
  [USERS_TAG]:
    "Finding other members by name, so they can be invited to a group",
  [CHATS_TAG]: "Chats between members, and the messages in them",
  [NOTIFICATIONS_TAG]:
    "What happened to a member: invitations, role changes, and activity in their groups",
  [SEARCH_TAG]: "Finding groups, threads and members by name in one request",
};

export default {
  openapi: "3.1.0",
  info: {
    title: APP_NAME,
    version: API_VERSION,
    description: APP_DESCRIPTION,
    // Omitted entirely when the deployment names nobody, rather than defaulted.
    ...(APP_CONTACT === undefined ? {} : { contact: APP_CONTACT }),
  },
  servers: [{ url: getRequiredEnvVariable("HOST_URL") }],
  tags: Object.entries(TAGS_WITH_DESCRIPTIONS).map(([name, description]) => ({
    name,
    description,
  })),
} satisfies OpenAPIObject;
