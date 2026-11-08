// Agent providers (Claude Code, Codex, Cursor): statuses, re-probe, enable/disable.
import type { Hono } from "hono";
import { PROVIDER_IDS, type ProviderId } from "../../shared/providers.ts";
import { changes } from "../changes.ts";
import { providerStatuses, refreshProvider, refreshProviders } from "../providers/registry.ts";
import { store } from "../store/store.ts";

export function registerProviderRoutes(app: Hono) {
  app.get("/api/providers", (c) => c.json(providerStatuses()));
  app.post("/api/providers/refresh", async (c) => {
    const { id } = (await c.req.json().catch(() => ({}))) as { id?: ProviderId };
    if (id && !PROVIDER_IDS.includes(id)) return c.json({ error: "unknown provider" }, 400);
    await (id ? refreshProvider(id) : refreshProviders(true));
    return c.json(providerStatuses());
  });
  app.post("/api/providers/:id/enabled", async (c) => {
    const id = c.req.param("id") as ProviderId;
    if (!PROVIDER_IDS.includes(id)) return c.json({ error: "unknown provider" }, 400);
    const { enabled } = (await c.req.json()) as { enabled: boolean };
    store.updateSettings({ providers: { ...store.settings().providers, [id]: { enabled } } });
    if (enabled) void refreshProvider(id);
    changes.emit("change");
    return c.json(providerStatuses());
  });
}
