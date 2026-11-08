// Chat (the composer): read, send, stop, delete.
import type { Hono } from "hono";
import { deleteChat, getChat, stopChat } from "../chat/chatStore.ts";
import { sendChat } from "../chat/sendChat.ts";

export function registerChatRoutes(app: Hono) {
  app.get("/api/chats/:id", (c) => {
    const chat = getChat(c.req.param("id"));
    return chat ? c.json(chat) : c.json({ error: "no such chat" }, 404);
  });
  app.post("/api/chats", async (c) => c.json(sendChat(await c.req.json())));
  app.post("/api/chats/:id/messages", async (c) =>
    c.json(sendChat({ ...(await c.req.json()), chatId: c.req.param("id") })),
  );
  app.post("/api/chats/:id/stop", (c) => {
    stopChat(c.req.param("id"));
    return c.json({ ok: true });
  });
  app.delete("/api/chats/:id", (c) => {
    deleteChat(c.req.param("id"));
    return c.json({ ok: true });
  });
}
