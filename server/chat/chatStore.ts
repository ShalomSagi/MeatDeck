// Chats on disk (~/.meatdeck/chats.json, newest first, last 60 kept), the turns running now, and
// the events the UI's stream listens to ("chat" per update, "list", "finished").
import type { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Chat, ChatMeta } from "../../shared/types.ts";
import { DATA_DIR } from "../store/persistence.ts";
import { store } from "../store/store.ts";

const FILE = join(DATA_DIR, "chats.json");
export const chatEvents = new EventEmitter();
chatEvents.setMaxListeners(100);

let chats: Chat[] = existsSync(FILE) ? (JSON.parse(readFileSync(FILE, "utf8")) as Chat[]) : [];
// Older chats get readable ids too (oldest first).
for (const c of [...chats].reverse()) c.ref ??= store.nextRef("C");
export const running = new Map<string, ChildProcess>();

export function persist() {
  const tmp = `${FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(chats.slice(0, 60)));
  renameSync(tmp, FILE);
}

/** Most recent first. */
export function bringToFront(chat: Chat) {
  chats = [chat, ...chats.filter((c) => c.id !== chat.id)];
}

export function chatList(): ChatMeta[] {
  return chats.map((c) => ({
    id: c.id,
    ref: c.ref,
    title: c.title,
    model: c.model,
    provider: c.provider ?? "claude",
    effort: c.effort,
    context: c.context,
    updatedAt: c.updatedAt,
    running: running.has(c.id),
    messageCount: c.messages.length,
  }));
}

export function getChat(chatId: string): Chat | undefined {
  return chats.find((c) => c.id === chatId);
}

export function deleteChat(chatId: string) {
  stopChat(chatId);
  chats = chats.filter((c) => c.id !== chatId);
  persist();
  chatEvents.emit("list");
}

export function stopChat(chatId: string) {
  running.get(chatId)?.kill("SIGTERM");
}
