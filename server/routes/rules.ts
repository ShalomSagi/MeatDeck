// Rules (every Claude run follows them; ignore_check is enforced in code) and learned preferences.
import type { Hono } from "hono";
import { changes } from "../changes.ts";
import { syncGithub } from "../reconcile.ts";
import { store } from "../store/store.ts";

export function registerRuleRoutes(app: Hono) {
  // ---- rules (every Claude run follows them; ignore_check is enforced in code) ----
  app.get("/api/rules", (c) => c.json(store.rules()));
  app.post("/api/rules", async (c) => {
    const rule = store.addRule(await c.req.json());
    if (rule.kind === "ignore_check") void syncGithub().then(() => changes.emit("change")); // re-evaluate CI now
    return c.json(rule);
  });
  app.patch("/api/rules/:id", async (c) => {
    const rule = store.updateRule(c.req.param("id"), await c.req.json());
    if (rule.kind === "ignore_check") void syncGithub().then(() => changes.emit("change"));
    return c.json(rule);
  });
  app.delete("/api/rules/:id", (c) => {
    const was = store.rules().find((r) => r.id === c.req.param("id"));
    store.removeRule(c.req.param("id"));
    if (was?.kind === "ignore_check") void syncGithub().then(() => changes.emit("change"));
    return c.json({ ok: true });
  });

  app.get("/api/preferences", (c) => c.json(store.preferences()));
  app.post("/api/preferences", async (c) => {
    const { text, from } = await c.req.json();
    if (!text?.trim()) return c.json({ error: "text required" }, 400);
    return c.json(store.addPreference(text, from));
  });
  app.delete("/api/preferences/:id", (c) => {
    store.removePreference(c.req.param("id"));
    return c.json({ ok: true });
  });
}
