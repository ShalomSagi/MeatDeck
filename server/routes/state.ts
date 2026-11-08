// Reading the dashboard: state, a past day, the live event stream, the digest, lookup and search;
// plus today's brief, settings and app updates.
import type { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { Chat } from "../../shared/types.ts";
import { changes } from "../changes.ts";
import { chatEvents } from "../chat/chatStore.ts";
import { snapshot } from "../dashboard.ts";
import { digest } from "../digest.ts";
import { resolve, search } from "../lookup.ts";
import { syncGithub } from "../reconcile.ts";
import { store } from "../store/store.ts";
import { applyUpdate, checkForUpdate } from "../updates.ts";

export function registerStateRoutes(app: Hono) {
  app.get("/api/state", (c) => c.json(snapshot()));
  app.get("/api/day/:date", (c) => {
    const day = store.day(c.req.param("date"));
    return day ? c.json(day) : c.json({ error: "no such day" }, 404);
  });

  app.get("/api/events", (c) =>
    streamSSE(c, async (stream) => {
      let pending: NodeJS.Timeout | undefined;
      const push = () => {
        clearTimeout(pending);
        pending = setTimeout(() => void stream.writeSSE({ event: "state", data: JSON.stringify(snapshot()) }), 50);
      };
      changes.on("change", push);
      // Chat streams token by token: send just that chat, not the whole state.
      const pushChat = (chat: Chat) => void stream.writeSSE({ event: "chat", data: JSON.stringify(chat) });
      chatEvents.on("chat", pushChat);
      stream.onAbort(() => {
        changes.off("change", push);
        chatEvents.off("chat", pushChat);
      });
      await stream.writeSSE({ event: "state", data: JSON.stringify(snapshot()) });
      while (!stream.aborted) {
        await stream.sleep(25_000);
        await stream.writeSSE({ event: "ping", data: "" });
      }
    }),
  );

  app.post("/api/brief", async (c) => {
    store.setBrief(await c.req.json());
    return c.json({ ok: true });
  });

  app.get("/api/digest", (c) => c.json(digest()));

  app.get("/api/settings", (c) => c.json(store.settings()));

  app.patch("/api/settings", async (c) => {
    const patch = await c.req.json();
    const settings = store.updateSettings(patch);
    // Re-query GitHub right away so newly ignored/unignored repos drop out or come back.
    if (patch.ignoredRepos) void syncGithub().then(() => changes.emit("change"));
    return c.json(settings);
  });

  // ---- readable ids: lookup + search (used by the MCP tools any Claude session gets) ----
  app.get("/api/lookup/:ref", (c) => {
    const r = resolve(decodeURIComponent(c.req.param("ref")));
    return r ? c.json(r) : c.json({ error: `Nothing in MeatDeck has id "${c.req.param("ref")}"` }, 404);
  });
  app.get("/api/search", (c) => c.json(search(c.req.query("q") ?? "")));

  app.post("/api/update/check", async (c) => c.json(await checkForUpdate()));
  app.post("/api/update/apply", (c) => c.json(applyUpdate()));
}
