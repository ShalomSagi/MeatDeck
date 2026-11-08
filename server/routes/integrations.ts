// Integrations: list, catalog, status, create/edit/delete, run an action, store a secret.
import type { Hono } from "hono";
import { CATEGORIES, actionSpec, type Integration } from "../../shared/integrations.ts";
import { changes } from "../changes.ts";
import { refreshStatuses, withStatus } from "../dashboard.ts";
import { mcpServers, runAction, setSecret, statusOf } from "../integrations.ts";
import { syncGithub } from "../reconcile.ts";
import { store } from "../store/store.ts";

export function registerIntegrationRoutes(app: Hono) {
  app.get("/api/integrations", (c) => c.json(withStatus()));
  app.get("/api/integrations/catalog", (c) => c.json(CATEGORIES));
  app.post("/api/integrations/status", async (c) => {
    await refreshStatuses(true);
    return c.json(withStatus());
  });
  app.get("/api/mcp-servers", async (c) => c.json(await mcpServers()));
  app.post("/api/integrations", async (c) => {
    const body = (await c.req.json()) as Integration;
    const base =
      body.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "integration";
    let id = base;
    for (let n = 2; store.integration(id); n++) id = `${base}-${n}`;
    const saved = store.saveIntegration({
      ...body,
      id: body.id && !store.integration(body.id) ? body.id : id,
      predefined: false,
    });
    void statusOf(saved, true).then(() => changes.emit("change"));
    return c.json(saved);
  });
  app.put("/api/integrations/:id", async (c) => {
    const saved = store.saveIntegration({ ...(await c.req.json()), id: c.req.param("id") });
    void statusOf(saved, true).then(() => changes.emit("change"));
    if (saved.category === "code") void syncGithub().then(() => changes.emit("change"));
    return c.json(saved);
  });
  app.delete("/api/integrations/:id", (c) => {
    store.deleteIntegration(c.req.param("id"));
    return c.json({ ok: true });
  });
  app.post("/api/integrations/:id/run", async (c) => {
    const { action, input = {}, allowWrite = false } = await c.req.json();
    const i = store.integration(c.req.param("id"));
    const spec = i && actionSpec(i.category, action);
    // Write actions only when the caller may write (the UI's Test asks first; scheduled runs never can).
    if (spec?.mode === "write" && !allowWrite)
      return c.json({ ok: false, error: "This is a write action; not allowed here." }, 403);
    return c.json(await runAction(c.req.param("id"), action, input));
  });
  app.post("/api/integrations/:id/secret", async (c) => {
    const { name, value } = await c.req.json();
    await setSecret(name, value);
    const i = store.integration(c.req.param("id"));
    if (i) void statusOf(i, true).then(() => changes.emit("change"));
    return c.json({ ok: true });
  });
}
