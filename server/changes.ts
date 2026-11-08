// One "something changed" signal for the UI's event stream: the store, runs, chats, providers,
// updates, permissions and routes all feed it (wired in index.ts).
import { EventEmitter } from "node:events";

export const changes = new EventEmitter();
changes.setMaxListeners(100);
