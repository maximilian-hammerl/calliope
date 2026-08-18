import { assertEquals } from "@std/assert";
import {
  type ChatEvent,
  countChatListeners,
  publishChatEvent,
  subscribeToChatEvents,
} from "./chat_events.ts";

const event: ChatEvent = {
  chatGroupId: "chat",
  message: {
    id: "message",
    text: "Kurz.",
    createdAt: "2026-08-18T12:00:00+00:00",
    createdBy: "author",
    createdByUsername: "mira",
  },
};

Deno.test("a subscriber receives what is published to it", () => {
  const received: Array<ChatEvent> = [];
  const unsubscribe = subscribeToChatEvents("annelie", (e) => received.push(e));

  publishChatEvent(["annelie"], event);

  assertEquals(received, [event]);
  unsubscribe();
});

Deno.test("one member may have several streams, and each gets it", () => {
  const received: Array<string> = [];
  const first = subscribeToChatEvents("annelie", () => received.push("phone"));
  const second = subscribeToChatEvents(
    "annelie",
    () => received.push("laptop"),
  );

  publishChatEvent(["annelie"], event);

  assertEquals(received.toSorted(), ["laptop", "phone"]);
  first();
  second();
});

Deno.test("unsubscribing stops delivery and leaves nothing behind", () => {
  const received: Array<ChatEvent> = [];
  const unsubscribe = subscribeToChatEvents("annelie", (e) => received.push(e));

  unsubscribe();
  publishChatEvent(["annelie"], event);

  assertEquals(received, []);
  // The map would otherwise keep an empty set per member who ever connected.
  assertEquals(countChatListeners("annelie"), 0);
});

Deno.test("nobody else is told", () => {
  const received: Array<ChatEvent> = [];
  const unsubscribe = subscribeToChatEvents("tomas", (e) => received.push(e));

  publishChatEvent(["annelie"], event);

  assertEquals(received, []);
  unsubscribe();
});

Deno.test("a listener that throws does not stop the others", () => {
  const received: Array<string> = [];
  const broken = subscribeToChatEvents("annelie", () => {
    throw new Error("this stream is gone");
  });
  const working = subscribeToChatEvents("annelie", () => received.push("ok"));

  // The message is already stored by the time this runs; a dead stream must not undo it.
  publishChatEvent(["annelie"], event);

  assertEquals(received, ["ok"]);
  broken();
  working();
});
