import { test } from "node:test";
import assert from "node:assert/strict";
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

test("a subscriber receives what is published to it", () => {
  const received: Array<ChatEvent> = [];
  const unsubscribe = subscribeToChatEvents("annelie", (e) => received.push(e));

  publishChatEvent(["annelie"], event);

  assert.deepEqual(received, [event]);
  unsubscribe();
});

test("one member may have several streams, and each gets it", () => {
  const received: Array<string> = [];
  const first = subscribeToChatEvents("annelie", () => received.push("phone"));
  const second = subscribeToChatEvents(
    "annelie",
    () => received.push("laptop"),
  );

  publishChatEvent(["annelie"], event);

  assert.deepEqual(received.toSorted(), ["laptop", "phone"]);
  first();
  second();
});

test("unsubscribing stops delivery and leaves nothing behind", () => {
  const received: Array<ChatEvent> = [];
  const unsubscribe = subscribeToChatEvents("annelie", (e) => received.push(e));

  unsubscribe();
  publishChatEvent(["annelie"], event);

  assert.deepEqual(received, []);
  // The map would otherwise keep an empty set per member who ever connected.
  assert.equal(countChatListeners("annelie"), 0);
});

test("nobody else is told", () => {
  const received: Array<ChatEvent> = [];
  const unsubscribe = subscribeToChatEvents("tomas", (e) => received.push(e));

  publishChatEvent(["annelie"], event);

  assert.deepEqual(received, []);
  unsubscribe();
});

test("a listener that throws does not stop the others", () => {
  const received: Array<string> = [];
  const broken = subscribeToChatEvents("annelie", () => {
    throw new Error("this stream is gone");
  });
  const working = subscribeToChatEvents("annelie", () => received.push("ok"));

  // The message is already stored by the time this runs; a dead stream must not undo it.
  publishChatEvent(["annelie"], event);

  assert.deepEqual(received, ["ok"]);
  broken();
  working();
});
