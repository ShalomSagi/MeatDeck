// Sending a chat message: create or continue the chat, pick its provider and model, and start the turn.
import { randomUUID } from "node:crypto";
import { PROVIDER_LABEL, type ProviderId } from "../../shared/providers.ts";
import type { Chat, ChatMessage, ContextRef } from "../../shared/types.ts";
import { providerStatus } from "../providers/registry.ts";
import { store } from "../store/store.ts";
import { bringToFront, getChat, persist, running } from "./chatStore.ts";
import { remember } from "./pageContext.ts";
import { expandSlash } from "./prompts.ts";
import { runTurn } from "./claudeTurn.ts";

const now = () => new Date().toISOString();

const id = () => randomUUID().slice(0, 8);

export function sendChat(input: {
  chatId?: string;
  text: string;
  context: ContextRef[];
  model?: string;
  provider?: ProviderId;
  effort?: string;
}): Chat {
  let chat = input.chatId ? getChat(input.chatId) : undefined;
  if (chat && running.has(chat.id)) throw new Error("This chat is still answering. Stop it or wait.");
  const settings = store.settings();
  const provider: ProviderId =
    input.provider ??
    (input.model ? (chat?.provider ?? "claude") : (chat?.provider ?? settings.chatProvider ?? "claude"));
  const p = providerStatus(provider);
  if (provider !== "claude" && (!p?.enabled || !p.installed))
    throw new Error(`${PROVIDER_LABEL[provider]} isn't available. Check Settings → Providers.`);
  if (!chat) {
    chat = {
      id: id(),
      ref: store.nextRef("C"),
      title: input.text.replace(/\s+/g, " ").slice(0, 60),
      model: input.model || settings.chatModel || "haiku",
      provider,
      ...((input.effort ?? settings.chatEffort) ? { effort: input.effort ?? settings.chatEffort } : {}),
      createdAt: now(),
      updatedAt: now(),
      messages: [],
    };
  }
  if (input.model) {
    chat.model = input.model;
    chat.provider = provider;
    chat.effort = input.effort || undefined;
  }
  const user: ChatMessage = { id: id(), role: "user", text: input.text, at: now(), context: input.context };
  // The chat keeps what it was started with (and anything attached later), so every turn sees it.
  const added = remember(chat, input.context ?? []);
  const reply: ChatMessage = {
    id: id(),
    role: "assistant",
    text: "",
    at: now(),
    parts: [],
    artifacts: [],
    status: "running",
  };
  chat.messages.push(user, reply);
  chat.updatedAt = now();
  bringToFront(chat);
  persist();
  runTurn(chat, reply, expandSlash(input.text), chat.context ?? [], added);
  return chat;
}
