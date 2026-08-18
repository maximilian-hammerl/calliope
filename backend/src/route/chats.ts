import { OpenAPIHono } from "@hono/zod-openapi";
import createChat from "./chats/create_chat.ts";
import listChats from "./chats/list_chats.ts";
import chatEventsStream from "./chats/chat_events_stream.ts";
import chat from "./chats/chat.ts";

export default new OpenAPIHono()
  .route("/", createChat)
  .route("/", listChats)
  // Before the :chatId branch, or "events" would be read as a chat id.
  .route("/events", chatEventsStream)
  .route("/:chatId", chat);
